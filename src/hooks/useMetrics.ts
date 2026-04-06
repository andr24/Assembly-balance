import { useMemo } from 'react';
import { Station, Connection, GlobalSettings, Metrics } from '../types';

export function useMetrics(stations: Station[], connections: Connection[], settings: GlobalSettings) {
  return useMemo((): Metrics => {
    const { demand, availableHours } = settings;
    const availableMinutes = availableHours * 60;
    
    const taktTime = availableMinutes / demand;
    const adjustedDemand = demand;
    const adjustedTakt = taktTime;
    
    // 1. Calculate Flow Factors
    const flowFactors: Record<string, number> = {};
    stations.forEach(s => {
      const isEntry = !connections.some(c => c.targetId === s.id && !c.isRework);
      flowFactors[s.id] = isEntry ? 1.0 : 0;
    });

    for (let i = 0; i < 20; i++) {
      stations.forEach(s => {
        const incoming = connections.filter(c => c.targetId === s.id);
        if (incoming.length > 0) {
          let newFactor = 0;
          const isEntry = !connections.some(c => c.targetId === s.id && !c.isRework);
          if (isEntry) newFactor = 1.0;

          if (s.flowMode === 'assembly') {
            const incomingFactors = incoming.map(c => (flowFactors[c.sourceId] || 0) * (c.splitPercent / 100));
            newFactor = Math.max(newFactor, ...incomingFactors);
          } else {
            incoming.forEach(c => {
              const sourceFactor = flowFactors[c.sourceId] || 0;
              newFactor += sourceFactor * (c.splitPercent / 100);
            });
          }
          flowFactors[s.id] = newFactor;
        }
      });
    }

    let bottleneckStationId: string | null = null;
    let maxStationLoad = 0;
    let totalEffectiveCT = 0;
    let totalWorkers = 0;

    stations.forEach(s => {
      const flowFactor = flowFactors[s.id] || 0;
      if (s.type === 'inventory') return;

      const isAutoBalanced = s.isAutoBalanced || settings.autoBalanceAll;
      const workers = isAutoBalanced 
        ? Math.max(1, Math.ceil((s.cycleTime * flowFactor) / adjustedTakt))
        : s.workers;
      
      const effectiveCT = s.cycleTime / workers;
      const stationLoad = effectiveCT * flowFactor;
      
      totalEffectiveCT += effectiveCT;
      totalWorkers += workers;
      
      if (stationLoad > maxStationLoad) {
        maxStationLoad = stationLoad;
        bottleneckStationId = s.id;
      }
    });

    // --- Worker Distribution Logic ---
    const finalWorkers: Record<string, number> = {};
    const idealInventories: Record<string, number> = {};

    if (settings.autoBalanceAll) {
      // 1. Ideal Worker Calculation (already handled above, but let's store it)
      stations.forEach(s => {
        if (s.type === 'inventory') return;
        const ff = flowFactors[s.id] || 0;
        finalWorkers[s.id] = Math.max(1, Math.ceil((s.cycleTime * ff) / adjustedTakt));
      });

      // 2. Ideal Buffer Calculation (to meet takt time)
      // For buffers, we want to ensure they can decouple variability or just represent the WIP needed to maintain flow.
      // A simple "ideal" buffer in VSM context often relates to the batch size or the demand during the replenishment interval.
      // Here we'll calculate it as the inventory needed to cover the takt time if there's a mismatch, 
      // but more simply, the user wants "ideal buffer size to meet takt time".
      // If a station is slower than takt, a buffer upstream doesn't help much unless it's for decoupling.
      // We'll calculate ideal inventory as 1.5x the flow factor (representing a safety stock of 1.5 units per takt interval)
      stations.forEach(s => {
        if (s.type === 'inventory') {
          const ff = flowFactors[s.id] || 0;
          idealInventories[s.id] = Math.ceil(ff * 2); // Rule of thumb: 2 units of WIP per flow unit
        }
      });
    } else if (settings.useConstrainedBalance && settings.totalWorkersPool) {
      // Constrained Optimization: Greedy approach to minimize bottleneck
      const pool = settings.totalWorkersPool;
      const activeStations = stations.filter(s => s.type !== 'inventory');
      
      // Start with 1 worker per station
      activeStations.forEach(s => finalWorkers[s.id] = 1);
      let remaining = pool - activeStations.length;

      if (remaining > 0) {
        for (let i = 0; i < remaining; i++) {
          let worstStationId = '';
          let worstLoad = -1;

          activeStations.forEach(s => {
            const currentWorkers = finalWorkers[s.id];
            const maxAllowed = s.maxWorkersAllowed || 100;
            if (currentWorkers < maxAllowed) {
              const ff = flowFactors[s.id] || 0;
              const currentLoad = (s.cycleTime / currentWorkers) * ff;
              if (currentLoad > worstLoad) {
                worstLoad = currentLoad;
                worstStationId = s.id;
              }
            }
          });

          if (worstStationId) {
            finalWorkers[worstStationId]++;
          } else {
            break; // All stations reached maxWorkersAllowed
          }
        }
      }

      // Recalculate metrics based on finalWorkers
      maxStationLoad = 0;
      totalWorkers = 0;
      totalEffectiveCT = 0;
      activeStations.forEach(s => {
        const workers = finalWorkers[s.id];
        const ff = flowFactors[s.id] || 0;
        const effectiveCT = s.cycleTime / workers;
        const stationLoad = effectiveCT * ff;
        totalEffectiveCT += effectiveCT;
        totalWorkers += workers;
        if (stationLoad > maxStationLoad) {
          maxStationLoad = stationLoad;
          bottleneckStationId = s.id;
        }
      });
    } else {
      // Default behavior: use station.workers
      stations.forEach(s => {
        if (s.type === 'inventory') return;
        finalWorkers[s.id] = s.workers;
      });
    }

    const lineOutput = maxStationLoad > 0 ? Math.floor(availableMinutes / maxStationLoad) : 0;
    const systemTakt = Math.max(adjustedTakt, maxStationLoad);
    
    // Lead time (Longest path search)
    const getLongestPath = (currentId: string, visited: Set<string> = new Set()): { time: number; stations: string[]; connections: string[] } => {
      if (visited.has(currentId)) return { time: 0, stations: [], connections: [] };
      const newVisited = new Set(visited);
      newVisited.add(currentId);
      
      const station = stations.find(s => s.id === currentId);
      if (!station) return { time: 0, stations: [], connections: [] };
      
      const flowFactor = flowFactors[currentId] || 0;
      let currentWaitTime = 0;

      if (station.type === 'inventory') {
        // Time in inventory = targetInventory * systemTakt / flowFactor
        const inventory = settings.autoBalanceAll ? (idealInventories[currentId] || 0) : (station.targetInventory || 0);
        currentWaitTime = flowFactor > 0 ? inventory * systemTakt / flowFactor : 0;
      } else {
        const workers = finalWorkers[currentId] || station.workers;
        currentWaitTime = station.cycleTime / workers;
      }
        
      const outgoing = connections.filter(c => c.sourceId === currentId && !c.isRework);
      
      if (outgoing.length === 0) {
        return { time: currentWaitTime, stations: [currentId], connections: [] };
      }
      
      let bestNext = { time: -1, stations: [] as string[], connections: [] as string[] };
      
      outgoing.forEach(c => {
        const res = getLongestPath(c.targetId, newVisited);
        if (res.time > bestNext.time) {
          bestNext = {
            time: res.time,
            stations: res.stations,
            connections: [c.id, ...res.connections]
          };
        }
      });
      
      return {
        time: currentWaitTime + bestNext.time,
        stations: [currentId, ...bestNext.stations],
        connections: bestNext.connections
      };
    };

    const entryStations = stations.filter(s => !connections.some(c => c.targetId === s.id && !c.isRework));
    let bestPath = { time: 0, stations: [] as string[], connections: [] as string[] };
    
    if (entryStations.length > 0) {
      entryStations.forEach(s => {
        const res = getLongestPath(s.id);
        if (res.time > bestPath.time) {
          bestPath = res;
        }
      });
    } else {
      bestPath.time = totalEffectiveCT;
    }

    const leadTime = bestPath.time;
    const criticalPathStationIds = bestPath.stations;
    const criticalPathConnectionIds = bestPath.connections;

    // VSM Metrics
    let vaTime = 0;
    let nvaTime = 0;
    
    criticalPathStationIds.forEach(id => {
      const s = stations.find(st => st.id === id);
      if (!s) return;
      if (s.type === 'inventory') {
        const ff = flowFactors[id] || 0;
        nvaTime += ff > 0 ? (s.targetInventory || 0) * systemTakt / ff : 0;
      } else {
        vaTime += s.cycleTime;
      }
    });

    const pce = (vaTime + nvaTime) > 0 ? (vaTime / (vaTime + nvaTime)) * 100 : 0;

    const lineEfficiency = (maxStationLoad > 0 && totalWorkers > 0)
      ? (totalEffectiveCT / (maxStationLoad * totalWorkers)) * 100
      : 0;

    const wip = (lineOutput / availableMinutes) * leadTime;

    return {
      taktTime,
      adjustedDemand,
      adjustedTakt,
      bottleneckStationId,
      lineOutput,
      leadTime,
      lineEfficiency,
      wip,
      totalWorkers,
      flowFactors,
      finalWorkers,
      idealInventories,
      criticalPathStationIds,
      criticalPathConnectionIds,
      vaTime,
      nvaTime,
      pce
    };
  }, [stations, connections, settings]);
}
