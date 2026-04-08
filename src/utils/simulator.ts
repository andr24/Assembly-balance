import { AssemblyLine, GlobalSettings, SimulationResult, SimulationSnapshot, Station, StationState } from '../types';

export function runSimulation(
  line: AssemblyLine,
  settings: GlobalSettings,
  durationMinutes: number = 480, // Default 8 hours
  snapshotInterval: number = 10,
  variability: number = 0, // 0 to 100 percentage
  enableRework: boolean = true
): SimulationResult {
  const stations = line.stations;
  const connections = line.connections;

  // Initialize state
  const inventory: Record<string, Record<string, number>> = {}; // stationId -> sourceId -> count
  const reworkInventory: Record<string, number> = {};
  const progress: Record<string, number> = {}; // 0 to 1
  const activeUnits: Record<string, number> = {}; // number of units currently being processed
  const currentUnitCT: Record<string, number> = {}; // CT for the current unit being processed
  const isRepairing: Record<string, boolean> = {}; // whether the station is currently repairing a unit on-the-spot
  const isDown: Record<string, boolean> = {}; // whether the station is currently broken down (MTBF/MTTR)
  const utilization: Record<string, number> = {}; // total minutes working
  const starvation: Record<string, number> = {}; // total minutes starved
  const blockage: Record<string, number> = {}; // total minutes blocked
  const defectsByStation: Record<string, number> = {};
  const reworkByStation: Record<string, number> = {};
  const outputsByStation: Record<string, number> = {};
  
  // Transit tracking
  interface TransitUnit {
    id: string;
    connectionId: string;
    targetId: string;
    sourceId: string;
    startTime: number;
    duration: number;
  }
  let transitUnits: TransitUnit[] = [];
  let unitCounter = 0;

  let totalOutput = 0;
  let totalDefects = 0;
  let totalRework = 0;
  const snapshots: SimulationSnapshot[] = [];

  stations.forEach(s => {
    inventory[s.id] = {};
    // Initialize input queues for all upstream connections
    connections.filter(c => c.targetId === s.id && !c.isRework).forEach(c => {
      inventory[s.id][c.sourceId] = s.type === 'inventory' ? Math.floor((s.capacity || 10) * 0.5) : 0;
    });

    // If it's an inventory with no upstream, it's a source
    const hasUpstream = connections.some(c => c.targetId === s.id && !c.isRework);
    if (s.type === 'inventory' && !hasUpstream) {
      // Sources start full
      inventory[s.id]['source'] = s.capacity || 1000; 
    }

    reworkInventory[s.id] = 0;
    progress[s.id] = 0;
    activeUnits[s.id] = 0;
    currentUnitCT[s.id] = 0;
    isRepairing[s.id] = false;
    isDown[s.id] = false;
    utilization[s.id] = 0;
    starvation[s.id] = 0;
    blockage[s.id] = 0;
    defectsByStation[s.id] = 0;
    reworkByStation[s.id] = 0;
    outputsByStation[s.id] = 0;
  });

  // Simulation loop (minute by minute)
  for (let t = 0; t <= durationMinutes; t++) {
    // 0. TRANSIT: Move units along connections
    transitUnits = transitUnits.filter(tu => {
      if (t >= tu.startTime + tu.duration) {
        // Unit arrived at target inventory
        inventory[tu.targetId][tu.sourceId] = (inventory[tu.targetId][tu.sourceId] || 0) + 1;
        return false;
      }
      return true;
    });

    // 0.5 BREAKDOWNS: Check if machines/stations are operational this minute
    stations.forEach(s => {
      if (s.mtbf !== undefined && s.mttr !== undefined && s.mtbf > 0 && s.mttr > 0) {
        if (isDown[s.id]) {
          // Try to recover: 1/MTTR chance per minute
          if (Math.random() < (1 / s.mttr)) isDown[s.id] = false;
        } else {
          // Chance to fail: 1/MTBF chance per minute
          if (Math.random() < (1 / s.mtbf)) isDown[s.id] = true;
        }
      }
    });

    // 1. PUSH: Stations that are finished try to push to downstream
    stations.forEach(s => {
      if (isDown[s.id]) return;
      if (s.type === 'inventory') {
        // Inventories always try to push if they have items
        let items = Object.values(inventory[s.id]).reduce((a, b) => a + b, 0);
        let pushesThisMinute = 0;
        
        while (items >= 1 && pushesThisMinute < 100) {
          const downstreamConns = connections.filter(c => c.sourceId === s.id && !c.isRework);
          
          if (downstreamConns.length === 0) {
            // End of line
            const sourceKey = Object.keys(inventory[s.id]).find(k => inventory[s.id][k] >= 1);
            if (sourceKey) {
              inventory[s.id][sourceKey]--;
              outputsByStation[s.id]++;
              totalOutput++;
              items--;
              pushesThisMinute++;
            } else {
              break;
            }
          } else {
            // Try to push to one of the downstream connections
            const availableConns = downstreamConns.filter(c => {
              const target = stations.find(st => st.id === c.targetId);
              if (target?.isKanbanSource) return true;
              if (target?.type === 'inventory') {
                const currentTargetInv = Object.values(inventory[c.targetId]).reduce((a, b) => a + b, 0);
                const inTransitToTarget = transitUnits.filter(tu => tu.targetId === c.targetId).length;
                return (currentTargetInv + inTransitToTarget) < (target?.capacity || 100);
              } else {
                // For machines, check per-source capacity to prevent deadlocks in assembly mode
                const currentTargetInvFromSource = inventory[c.targetId][s.id] || 0;
                const inTransitToTargetFromSource = transitUnits.filter(tu => tu.targetId === c.targetId && tu.sourceId === s.id).length;
                return (currentTargetInvFromSource + inTransitToTargetFromSource) < (target?.capacity || 10);
              }
            });

            if (availableConns.length > 0) {
              const totalWeight = availableConns.reduce((sum, c) => sum + (c.splitPercent ?? 100), 0);
              let conn = availableConns[availableConns.length - 1];
              if (totalWeight > 0) {
                const rand = Math.random() * totalWeight;
                let cumulative = 0;
                for (const c of availableConns) {
                  cumulative += (c.splitPercent ?? 100);
                  if (rand <= cumulative) {
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
              } else {
                break;
              }
            } else {
              break; // Blocked
            }
          }
        }
        return;
      }

      // Stations push when progress >= 1
      if (activeUnits[s.id] > 0 && progress[s.id] >= 1) {
        const downstreamConns = connections.filter(c => c.sourceId === s.id && !c.isRework);
        
        if (downstreamConns.length === 0) {
          outputsByStation[s.id]++;
          totalOutput++;
          activeUnits[s.id] = 0;
          progress[s.id] = 0;
          isRepairing[s.id] = false;
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
            const totalWeight = availableConns.reduce((sum, c) => sum + (c.splitPercent ?? 100), 0);
            let conn = availableConns[availableConns.length - 1];
            if (totalWeight > 0) {
              const rand = Math.random() * totalWeight;
              let cumulative = 0;
              for (const c of availableConns) {
                cumulative += (c.splitPercent ?? 100);
                if (rand <= cumulative) {
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
            activeUnits[s.id] = 0;
            progress[s.id] = 0;
            isRepairing[s.id] = false;
          } else {
            blockage[s.id]++;
          }
        }
      }
    });

    // 2. PULL: Idle stations try to pull from their input queues
    stations.forEach(s => {
      if (s.type === 'inventory') return;
      if (isDown[s.id]) return;
      if (activeUnits[s.id] > 0) return; // Already working

      // Priority 1: Rework
      if (reworkInventory[s.id] >= 1) {
        reworkInventory[s.id]--;
        activeUnits[s.id] = 1;
        progress[s.id] = 0;
        const baseCT = s.type === 'machine' ? s.cycleTime / (s.batchSize || 1) : s.cycleTime / (s.fte || 1);
        
        // Machines are more consistent (lower variability)
        const stationVariability = s.type === 'machine' ? variability * 0.3 : variability;
        const varFactor = 1 + (Math.random() * 2 - 1) * (stationVariability / 100);
        
        currentUnitCT[s.id] = Math.max(0.1, baseCT * varFactor);
        return;
      }

      // Priority 2: Normal Upstream
      const upstreamConns = connections.filter(c => c.targetId === s.id && !c.isRework);
      
      const getGroups = (conns: any[]) => {
        const groups: Record<string, any[]> = {};
        conns.forEach(c => {
          const groupName = c.inputGroup || `_conn_${c.id}`; // unique if no group
          if (!groups[groupName]) groups[groupName] = [];
          groups[groupName].push(c);
        });
        return groups;
      };

      let canPull = false;
      if (upstreamConns.length === 0) {
        // Source station
        canPull = true;
      } else if (s.flowMode === 'assembly') {
        // Must have at least one from EACH group
        const groups = getGroups(upstreamConns);
        canPull = Object.values(groups).every(groupConns => 
          groupConns.some(c => inventory[s.id][c.sourceId] >= 1)
        );
      } else {
        // Normal station: pull if ANY upstream has units in our queue
        canPull = upstreamConns.some(c => inventory[s.id][c.sourceId] >= 1);
      }

      if (canPull) {
        if (upstreamConns.length > 0) {
          if (s.flowMode === 'assembly') {
            const groups = getGroups(upstreamConns);
            Object.values(groups).forEach(groupConns => {
              // Pull from the first connection in the group that has inventory
              const connToPull = groupConns.find(c => inventory[s.id][c.sourceId] >= 1);
              if (connToPull) {
                inventory[s.id][connToPull.sourceId]--;
              }
            });
          } else {
            // Pull from the first one that has items
            const conn = upstreamConns.find(c => inventory[s.id][c.sourceId] >= 1);
            if (conn) inventory[s.id][conn.sourceId]--;
          }
        }
        
        activeUnits[s.id] = 1;
        progress[s.id] = 0;
        const baseCT = s.type === 'machine' ? s.cycleTime / (s.batchSize || 1) : s.cycleTime / (s.fte || 1);
        
        // Machines are more consistent (lower variability)
        const stationVariability = s.type === 'machine' ? variability * 0.3 : variability;
        const varFactor = 1 + (Math.random() * 2 - 1) * (stationVariability / 100);
        
        currentUnitCT[s.id] = Math.max(0.1, baseCT * varFactor);
      } else {
        starvation[s.id]++;
      }
    });

    // 3. WORK: Advance progress for active stations
    stations.forEach(s => {
      if (s.type === 'inventory') return;
      if (isDown[s.id]) return;
      
      if (activeUnits[s.id] > 0 && progress[s.id] < 1) {
        progress[s.id] += (1 / (currentUnitCT[s.id] || 1));
        utilization[s.id]++;

        // Check for quality failure immediately when finished
        if (progress[s.id] >= 1) {
          const quality = s.qualityRate ?? 100;
          if (!isRepairing[s.id] && Math.random() * 100 > quality) {
            const reworkConn = enableRework ? connections.find(c => c.targetId === s.id && c.isRework) : null;
            if (reworkConn) {
              totalRework++;
              reworkByStation[s.id]++;
              reworkInventory[reworkConn.sourceId]++;
              activeUnits[s.id] = 0;
              progress[s.id] = 0;
            } else {
              progress[s.id] = 0;
              isRepairing[s.id] = true;
              currentUnitCT[s.id] *= 1.5;
              totalDefects++;
              defectsByStation[s.id]++;
            }
          }
        }
      }
    });

    // 4. SNAPSHOT
    if (t % snapshotInterval === 0 || t === durationMinutes) {
      const flatInventory: Record<string, number> = {};
      stations.forEach(st => {
        if (st.isKanbanSource) {
          flatInventory[st.id] = 0;
        } else {
          flatInventory[st.id] = Object.values(inventory[st.id] || {}).reduce((a, b) => a + b, 0);
        }
      });

      const stationStates: Record<string, StationState> = {};
      const missingParts: Record<string, string[]> = {};

      stations.forEach(s => {
        if (s.type === 'inventory') {
          stationStates[s.id] = 'idle';
        } else if (isDown[s.id]) {
          stationStates[s.id] = 'down';
        } else if (activeUnits[s.id] > 0) {
          if (progress[s.id] >= 1) {
            stationStates[s.id] = 'blocked';
          } else {
            stationStates[s.id] = 'working';
          }
        } else {
          stationStates[s.id] = 'starved';
          // Check why it's starved
          const upstreamConns = connections.filter(c => c.targetId === s.id && !c.isRework);
          if (upstreamConns.length > 0) {
            const missing: string[] = [];
            
            if (s.flowMode === 'assembly') {
              const getGroups = (conns: any[]) => {
                const groups: Record<string, any[]> = {};
                conns.forEach(c => {
                  const groupName = c.inputGroup || `_conn_${c.id}`;
                  if (!groups[groupName]) groups[groupName] = [];
                  groups[groupName].push(c);
                });
                return groups;
              };
              
              const groups = getGroups(upstreamConns);
              Object.entries(groups).forEach(([groupName, groupConns]) => {
                const hasAny = groupConns.some(c => (inventory[s.id][c.sourceId] || 0) >= 1);
                if (!hasAny) {
                  if (groupName.startsWith('_conn_')) {
                    const source = stations.find(st => st.id === groupConns[0].sourceId);
                    missing.push(source?.name || 'Unknown Source');
                  } else {
                    missing.push(`Group: ${groupName}`);
                  }
                }
              });
            } else {
              const hasAny = upstreamConns.some(c => (inventory[s.id][c.sourceId] || 0) >= 1);
              if (!hasAny) {
                missing.push('Any Input');
              }
            }

            if (missing.length > 0) {
              missingParts[s.id] = missing;
            }
          }
        }
      });

      const snapshotUnits: { id: string, stationId?: string, connectionId?: string, progress: number }[] = [];
      
      // Units at stations
      stations.forEach(s => {
        if (activeUnits[s.id] > 0) {
          snapshotUnits.push({
            id: `active-${s.id}`,
            stationId: s.id,
            progress: progress[s.id]
          });
        }
      });

      // Units in transit
      transitUnits.forEach(tu => {
        snapshotUnits.push({
          id: tu.id,
          connectionId: tu.connectionId,
          progress: (t - tu.startTime) / tu.duration
        });
      });

      snapshots.push({
        time: t,
        output: totalOutput,
        defects: totalDefects,
        rework: totalRework,
        inventory: flatInventory,
        stationOutputs: { ...outputsByStation },
        wip: Object.values(flatInventory).reduce((a, b) => a + b, 0) + 
             Object.values(reworkInventory).reduce((a, b) => a + b, 0) +
             Object.values(activeUnits).reduce((a, b) => a + b, 0) +
             transitUnits.length,
        stationStates,
        missingParts,
        units: snapshotUnits
      });
    }
  }

  // Calculate final percentages and flatten inventory
  const stationUtilization: Record<string, number> = {};
  const starvationTime: Record<string, number> = {};
  const blockageTime: Record<string, number> = {};
  const finalFlatInventory: Record<string, number> = {};

  stations.forEach(s => {
    stationUtilization[s.id] = (utilization[s.id] / durationMinutes) * 100;
    starvationTime[s.id] = (starvation[s.id] / durationMinutes) * 100;
    blockageTime[s.id] = (blockage[s.id] / durationMinutes) * 100;
    finalFlatInventory[s.id] = Object.values(inventory[s.id] || {}).reduce((a, b) => a + b, 0);
  });

  return {
    snapshots,
    totalOutput,
    totalDefects,
    totalRework,
    finalInventory: finalFlatInventory,
    stationUtilization,
    starvationTime,
    blockageTime,
    defectsByStation,
    reworkByStation,
    outputsByStation
  };
}
