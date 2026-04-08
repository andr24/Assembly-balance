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
    let totalFTE = 0;

    stations.forEach(s => {
      const flowFactor = flowFactors[s.id] || 0;
      if (s.type === 'inventory') return;

      let effectiveCT = 0;
      let fte = 0;

      if (s.type === 'machine') {
        effectiveCT = s.cycleTime / (s.batchSize || 1);
      } else {
        fte = s.fte || 1;
        effectiveCT = s.cycleTime / fte;
        totalFTE += s.fte || 0;
      }
      
      const stationLoad = effectiveCT * flowFactor;
      
      totalEffectiveCT += effectiveCT;
      
      if (stationLoad > maxStationLoad) {
        maxStationLoad = stationLoad;
        bottleneckStationId = s.id;
      }
    });

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
        const inventory = station.targetInventory || 0;
        currentWaitTime = flowFactor > 0 ? inventory * systemTakt / flowFactor : 0;
      } else if (station.type === 'machine') {
        currentWaitTime = station.cycleTime / (station.batchSize || 1);
      } else {
        const fte = station.fte || 1;
        currentWaitTime = station.cycleTime / fte;
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

    const lineEfficiency = (maxStationLoad > 0 && totalFTE > 0)
      ? (totalEffectiveCT / (maxStationLoad * totalFTE)) * 100
      : 0;

    const wip = (lineOutput / availableMinutes) * leadTime;

    return {
      taktTime,
      adjustedDemand,
      adjustedTakt,
      systemTakt,
      maxStationLoad,
      bottleneckStationId,
      lineOutput,
      leadTime,
      lineEfficiency,
      wip,
      totalFTE,
      flowFactors,
      criticalPathStationIds,
      criticalPathConnectionIds,
      vaTime,
      nvaTime,
      pce
    };
  }, [stations, connections, settings]);
}
