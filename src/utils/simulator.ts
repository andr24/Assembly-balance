import { AssemblyLine, GlobalSettings, SimulationResult, Station, StationState, SimulationSnapshot, ShiftMetric, Connection } from '../types';
import { parseTime } from './timeUtils';

export function runSimulation(
  line: AssemblyLine,
  settings: GlobalSettings,
  durationMinutes: number = 480,
  snapshotInterval: number = 10,
  variability: number = 0,
  enableRework: boolean = true,
  startTime: number = 0,
  endTime: number = 1440
): SimulationResult {
  console.log("runSimulation settings.schedule:", JSON.stringify(settings.schedule));
  const stations = line.stations;
  const connections = line.connections;
  const inventory: Record<string, Record<string, number>> = {};
  const stationUnits: Record<string, { progress: number, ct: number, isRepairing: boolean }[]> = {};
  const isDown: Record<string, boolean> = {};
  const blockage: Record<string, number> = {};
  const starvation: Record<string, number> = {};
  const utilization: Record<string, number> = {};
  const outputsByStation: Record<string, number> = {};
  const reworkByStation: Record<string, number> = {};
  const defectsByStation: Record<string, number> = {};
  const reworkInventory: Record<string, number> = {};
  const availableMinutes: Record<string, number> = {};
  let transitUnits: any[] = [];
  let unitCounter = 0;
  let totalOutput = 0;
  let totalRework = 0;
  let totalDefects = 0;

  stations.forEach(s => {
    inventory[s.id] = {};
    stationUnits[s.id] = [];
    isDown[s.id] = false;
    blockage[s.id] = 0;
    starvation[s.id] = 0;
    utilization[s.id] = 0;
    outputsByStation[s.id] = 0;
    reworkByStation[s.id] = 0;
    defectsByStation[s.id] = 0;
    reworkInventory[s.id] = 0;
    availableMinutes[s.id] = 0;
  });

  const snapshots: SimulationSnapshot[] = [];
  const shiftMetricsMap: Record<string, ShiftMetric> = {};
  let prevTotalOutput = 0;
  let prevTotalDefects = 0;
  let prevTotalRework = 0;

  const totalLineFteRequired = stations.reduce((acc, s) => acc + (s.fte || 0), 0);

  for (let t = startTime; t <= endTime; t++) {
    const minutesInDay = t % 1440;
    const dayIndex = Math.floor(t / 1440);
    const dayOfWeek = dayIndex % 7;
    const currentStates: Record<string, StationState> = {};
    const onShiftStatus: Record<string, boolean> = {};
    
    const daySchedule = settings.schedule?.days[dayOfWeek];
    let currentShiftFte: number | undefined = undefined;
    let currentShift: any = null;

    const isStationOnShift = (s: Station) => {
      if (!settings.schedule) return true;
      if (!daySchedule) return false;

      const shift = daySchedule.shifts.find(shift => {
        const start = parseTime(shift.startTime);
        const end = parseTime(shift.endTime);
        const lunchStart = shift.lunchBreakStart ? parseTime(shift.lunchBreakStart) : -1;
        const lunchEnd = shift.lunchBreakEnd ? parseTime(shift.lunchBreakEnd) : -1;

        let onShift = false;
        if (start <= end) {
          onShift = minutesInDay >= start && minutesInDay < end;
        } else {
          // Spans midnight
          onShift = minutesInDay >= start || minutesInDay < end;
        }

        let onLunch = false;
        if (lunchStart !== -1 && lunchEnd !== -1) {
          if (lunchStart <= lunchEnd) {
            onLunch = minutesInDay >= lunchStart && minutesInDay < lunchEnd;
          } else {
            // Lunch spans midnight
            onLunch = minutesInDay >= lunchStart || minutesInDay < lunchEnd;
          }
        }

        if (onShift && !onLunch) {
          currentShift = shift;
          currentShiftFte = shift.fte;
        }

        return onShift && !onLunch;
      });
      
      return !!shift;
    };
    
    stations.forEach(s => {
      onShiftStatus[s.id] = isStationOnShift(s);
      if (onShiftStatus[s.id]) {
        availableMinutes[s.id]++;
      }
      currentStates[s.id] = isDown[s.id] ? 'down' : (onShiftStatus[s.id] ? 'idle' : 'off-shift');
    });

    const staffingRatio = (currentShiftFte !== undefined && totalLineFteRequired > 0) 
      ? (currentShiftFte / totalLineFteRequired) 
      : 1;

    // 0. TRANSIT: Move units along connections
    transitUnits = transitUnits.filter(tu => {
      if (t >= tu.startTime + tu.duration) {
        inventory[tu.targetId][tu.sourceId] = (inventory[tu.targetId][tu.sourceId] || 0) + 1;
        return false;
      }
      return true;
    });

    // 0.5 BREAKDOWNS
    stations.forEach(s => {
      if (s.mtbf !== undefined && s.mttr !== undefined && s.mtbf > 0 && s.mttr > 0) {
        if (isDown[s.id]) {
          if (Math.random() < (1 / s.mttr)) isDown[s.id] = false;
        } else {
          if (Math.random() < (1 / s.mtbf)) isDown[s.id] = true;
        }
      }
    });

    // 1. PUSH
    stations.forEach(s => {
      if (isDown[s.id] || !onShiftStatus[s.id]) return;
      if (s.type === 'inventory') {
        let items = Object.values(inventory[s.id]).reduce((a, b) => a + b, 0);
        let pushesThisMinute = 0;
        while (items >= 1 && pushesThisMinute < 100) {
          const downstreamConns = connections.filter(c => c.sourceId === s.id && !c.isRework);
          if (downstreamConns.length === 0) {
            const sourceKey = Object.keys(inventory[s.id]).find(k => inventory[s.id][k] >= 1);
            if (sourceKey) {
              inventory[s.id][sourceKey]--;
              outputsByStation[s.id]++;
              totalOutput++;
              items--;
              pushesThisMinute++;
            } else break;
          } else {
            const availableConns = downstreamConns.filter(c => {
              const target = stations.find(st => st.id === c.targetId);
              if (target?.isKanbanSource) return true;
              if (target?.type === 'inventory') {
                const currentTargetInv = Object.values(inventory[c.targetId]).reduce((a, b) => a + b, 0);
                const inTransitToTarget = transitUnits.filter(tu => tu.targetId === c.targetId).length;
                return (currentTargetInv + inTransitToTarget) < (target?.capacity || 100);
              } else {
                const currentTargetInvFromSource = inventory[c.targetId][s.id] || 0;
                const inTransitToTargetFromSource = transitUnits.filter(tu => tu.targetId === c.targetId && tu.sourceId === s.id).length;
                return (currentTargetInvFromSource + inTransitToTargetFromSource) < (target?.capacity || 10);
              }
            });
            if (availableConns.length > 0) {
              // Split logic based on splitPercent
              let conn = availableConns[0];
              const totalWeight = availableConns.reduce((acc, c) => acc + (c.splitPercent || 0), 0);
              if (totalWeight > 0) {
                let rand = Math.random() * totalWeight;
                for (const c of availableConns) {
                  rand -= (c.splitPercent || 0);
                  if (rand <= 0) {
                    conn = c;
                    break;
                  }
                }
              }

              const sourceKey = Object.keys(inventory[s.id]).find(k => inventory[s.id][k] >= 1);
              if (sourceKey) {
                inventory[s.id][sourceKey]--;
                outputsByStation[s.id]++;
                transitUnits.push({
                  id: `unit-${unitCounter++}`,
                  connectionId: conn.id,
                  targetId: conn.targetId,
                  sourceId: s.id,
                  startTime: t,
                  duration: Math.max(1, conn.transitTime || 2)
                });
                items--;
                pushesThisMinute++;
              } else break;
            } else break;
          }
        }
        return;
      }
      if (stationUnits[s.id].length > 0) {
        const capacity = s.type === 'machine' ? (s.batchSize || 1) : 1;
        // Check for finished units
        for (let i = stationUnits[s.id].length - 1; i >= 0; i--) {
          const unit = stationUnits[s.id][i];
          if (unit.progress >= 1) {
            const downstreamConns = connections.filter(c => c.sourceId === s.id && !c.isRework);
            if (downstreamConns.length === 0) {
              outputsByStation[s.id]++;
              totalOutput++;
              stationUnits[s.id].splice(i, 1);
            } else {
              const availableConns = downstreamConns.filter(c => {
                const target = stations.find(st => st.id === c.targetId);
                if (target?.isKanbanSource) return true;
                if (target?.type === 'inventory') {
                  const currentTargetInv = Object.values(inventory[c.targetId]).reduce((a, b) => a + b, 0);
                  const inTransitToTarget = transitUnits.filter(tu => tu.targetId === c.targetId).length;
                  return (currentTargetInv + inTransitToTarget + 1) <= (target?.capacity || 100);
                } else {
                  const currentTargetInvFromSource = inventory[c.targetId][s.id] || 0;
                  const inTransitToTargetFromSource = transitUnits.filter(tu => tu.targetId === c.targetId && tu.sourceId === s.id).length;
                  return (currentTargetInvFromSource + inTransitToTargetFromSource + 1) <= (target?.capacity || 10);
                }
              });
              if (availableConns.length > 0) {
                let conn = availableConns[0];
                const totalWeight = availableConns.reduce((acc, c) => acc + (c.splitPercent || 0), 0);
                if (totalWeight > 0) {
                  let rand = Math.random() * totalWeight;
                  for (const c of availableConns) {
                    rand -= (c.splitPercent || 0);
                    if (rand <= 0) {
                      conn = c;
                      break;
                    }
                  }
                }

                outputsByStation[s.id]++;
                transitUnits.push({
                  id: `unit-${unitCounter++}`,
                  connectionId: conn.id,
                  targetId: conn.targetId,
                  sourceId: s.id,
                  startTime: t,
                  duration: Math.max(1, conn.transitTime || 2)
                });
                stationUnits[s.id].splice(i, 1);
              } else {
                blockage[s.id]++;
                currentStates[s.id] = 'blocked';
              }
            }
          }
        }
      }
    });

    // 2. PULL
    const missingPartsThisMinute: Record<string, string[]> = {};

    stations.forEach(s => {
      if (s.type === 'inventory' || isDown[s.id] || !onShiftStatus[s.id]) return;
      
      const capacity = s.type === 'machine' ? (s.batchSize || 1) : 1;
      if (stationUnits[s.id].length >= capacity) return;

      if (reworkInventory[s.id] >= 1) {
        reworkInventory[s.id]--;
        const effectiveFte = (s.fte || 1) * staffingRatio;
        const baseCT = s.type === 'machine' ? s.cycleTime : s.cycleTime / effectiveFte;
        stationUnits[s.id].push({ progress: 0, ct: baseCT, isRepairing: false });
        return;
      }
      
      const upstreamConns = connections.filter(c => c.targetId === s.id && !c.isRework);
      
      const hasAvailableParts = (targetId: string, sourceId: string, required: number) => {
        const sourceStation = stations.find(st => st.id === sourceId);
        if (sourceStation?.isKanbanSource) return true;
        return (inventory[targetId][sourceId] || 0) >= required;
      };

      const consumeParts = (targetId: string, sourceId: string, required: number) => {
        const sourceStation = stations.find(st => st.id === sourceId);
        if (!sourceStation?.isKanbanSource) {
          inventory[targetId][sourceId] -= required;
        }
      };

      if (s.flowMode === 'assembly') {
        // Assembly logic: Need parts from ALL input groups
        const groups: Record<string, Connection[]> = {};
        upstreamConns.forEach(c => {
          const groupKey = c.inputGroup || `default-${c.id}`;
          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(c);
        });

        const missingFromGroups: string[] = [];
        const canPullAllGroups = Object.entries(groups).every(([groupKey, conns]) => {
          const hasPart = conns.some(c => hasAvailableParts(s.id, c.sourceId, 1));
          if (!hasPart) {
            const sourceNames = conns.map(c => stations.find(st => st.id === c.sourceId)?.name || 'Unknown');
            missingFromGroups.push(...sourceNames);
          }
          return hasPart;
        });

        if (canPullAllGroups) {
          // Pull one from each group
          Object.values(groups).forEach(conns => {
            const conn = conns.find(c => hasAvailableParts(s.id, c.sourceId, 1));
            if (conn) consumeParts(s.id, conn.sourceId, 1);
          });
          const effectiveFte = (s.fte || 1) * staffingRatio;
          const baseCT = s.type === 'machine' ? s.cycleTime : s.cycleTime / effectiveFte;
          stationUnits[s.id].push({ progress: 0, ct: baseCT, isRepairing: false });
          currentStates[s.id] = 'working';
        } else {
          if (missingFromGroups.length > 0) {
            missingPartsThisMinute[s.id] = missingFromGroups;
          }
          if (stationUnits[s.id].length === 0) {
            starvation[s.id]++;
            currentStates[s.id] = 'starved';
          }
        }
      } else {
        // Additive logic (default): Pull from ANY available upstream connection
        const canPull = upstreamConns.length === 0 || upstreamConns.some(c => hasAvailableParts(s.id, c.sourceId, 1));
        if (canPull) {
          if (upstreamConns.length > 0) {
            const conn = upstreamConns.find(c => hasAvailableParts(s.id, c.sourceId, 1));
            if (conn) consumeParts(s.id, conn.sourceId, 1);
          }
          const effectiveFte = (s.fte || 1) * staffingRatio;
          const baseCT = s.type === 'machine' ? s.cycleTime : s.cycleTime / effectiveFte;
          stationUnits[s.id].push({ progress: 0, ct: baseCT, isRepairing: false });
          currentStates[s.id] = 'working';
        } else {
          if (stationUnits[s.id].length === 0) {
            starvation[s.id]++;
            currentStates[s.id] = 'starved';
          }
        }
      }
    });

    // 3. WORK
    stations.forEach(s => {
      if (s.type === 'inventory' || isDown[s.id] || !onShiftStatus[s.id]) return;
      const capacity = s.type === 'machine' ? (s.batchSize || 1) : 1;
      
      stationUnits[s.id].forEach((unit, i) => {
        if (unit.progress < 1) {
          unit.progress += (1 / (unit.ct || 1));
          utilization[s.id] += (1 / capacity);
          currentStates[s.id] = 'working';
          
          if (unit.progress >= 1) {
            const quality = s.qualityRate ?? 100;
            if (!unit.isRepairing && Math.random() * 100 > quality) {
              const reworkConn = enableRework ? connections.find(c => c.targetId === s.id && c.isRework) : null;
              if (reworkConn) {
                totalRework++;
                reworkByStation[s.id]++;
                reworkInventory[reworkConn.sourceId]++;
                stationUnits[s.id].splice(i, 1);
              } else {
                unit.progress = 0;
                unit.isRepairing = true;
                unit.ct *= 1.5;
                totalDefects++;
                defectsByStation[s.id]++;
              }
            }
          }
        }
      });
    });

    // 3.5 TRACK SHIFT METRICS
    const shiftId = `${dayIndex}-${currentShift ? daySchedule?.shifts.indexOf(currentShift) : -1}`;
    if (!shiftMetricsMap[shiftId]) {
      const dayOfWeek = dayIndex % 7;
      const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek];
      shiftMetricsMap[shiftId] = {
        dayIndex,
        shiftIndex: currentShift ? daySchedule?.shifts.indexOf(currentShift) ?? -1 : -1,
        shiftName: currentShift ? currentShift.name : "Off Shift",
        weekday,
        output: 0,
        defects: 0,
        rework: 0
      };
    }
    shiftMetricsMap[shiftId].output += (totalOutput - prevTotalOutput);
    shiftMetricsMap[shiftId].defects += (totalDefects - prevTotalDefects);
    shiftMetricsMap[shiftId].rework += (totalRework - prevTotalRework);
    
    prevTotalOutput = totalOutput;
    prevTotalDefects = totalDefects;
    prevTotalRework = totalRework;

    // 4. SNAPSHOT
    if (t % snapshotInterval === 0 || t === endTime) {
      const minutesInDay = t % 1440;
      const dayIndex = Math.floor(t / 1440);
      const dayOfWeek = dayIndex % 7;
      const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek];
      
      // Find current shift
      const daySchedule = settings.schedule?.days[dayOfWeek];
      let shiftIndex = -1;
      let shiftName = "Off Shift";
      let shiftStartTime = "";
      let shiftEndTime = "";
      if (daySchedule) {
        const shift = daySchedule.shifts.find(s => {
          const start = parseTime(s.startTime);
          const end = parseTime(s.endTime);
          
          let onShift = false;
          if (start <= end) {
            onShift = minutesInDay >= start && minutesInDay < end;
          } else {
            onShift = minutesInDay >= start || minutesInDay < end;
          }
          return onShift;
        });
        if (shift) {
          shiftIndex = daySchedule.shifts.indexOf(shift);
          shiftName = shift.name;
          shiftStartTime = shift.startTime;
          shiftEndTime = shift.endTime;
        }
      }

      const flatInventory: Record<string, number> = {};
      stations.forEach(st => {
        flatInventory[st.id] = st.isKanbanSource ? 0 : Object.values(inventory[st.id] || {}).reduce((a, b) => a + b, 0);
      });
      const snapshotUnits: { id: string, stationId?: string, connectionId?: string, progress: number }[] = [];
      transitUnits.forEach(tu => {
        snapshotUnits.push({
          id: tu.id,
          connectionId: tu.connectionId,
          progress: (t - tu.startTime) / tu.duration
        });
      });
      stations.forEach(s => {
        stationUnits[s.id].forEach((unit, idx) => {
          snapshotUnits.push({
            id: `active-${s.id}-${idx}`,
            stationId: s.id,
            progress: unit.progress
          });
        });
      });

      snapshots.push({
        time: t,
        dayIndex,
        shiftIndex,
        shiftName,
        shiftStartTime,
        shiftEndTime,
        weekday,
        output: totalOutput,
        defects: totalDefects,
        rework: totalRework,
        inventory: flatInventory,
        stationOutputs: outputsByStation,
        wip: Object.values(flatInventory).reduce((a, b) => a + b, 0),
        stationStates: currentStates,
        staffingRatio,
        missingParts: missingPartsThisMinute,
        units: snapshotUnits
      });
    }
  }

  // Sort shift metrics chronologically
  const shiftMetrics = Object.values(shiftMetricsMap).sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return a.shiftIndex - b.shiftIndex;
  });

  const stationUtilization: Record<string, number> = {};
  const starvationTime: Record<string, number> = {};
  const blockageTime: Record<string, number> = {};

  stations.forEach(s => {
    const totalAvailable = availableMinutes[s.id] || 1;
    stationUtilization[s.id] = (utilization[s.id] / totalAvailable) * 100;
    starvationTime[s.id] = (starvation[s.id] / totalAvailable) * 100;
    blockageTime[s.id] = (blockage[s.id] / totalAvailable) * 100;
  });

  return {
    totalOutput,
    totalRework,
    totalDefects,
    outputsByStation,
    reworkByStation,
    defectsByStation,
    snapshots,
    finalInventory: {}, 
    stationUtilization,
    starvationTime,
    blockageTime,
    shiftMetrics
  };
}
