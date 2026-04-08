import { AssemblyLine, GlobalSettings, Station } from '../types';

export interface BalancerResult {
  lines: AssemblyLine[];
  metrics: {
    totalFteUsed: number;
    totalOutput: number;
    averageEfficiency: number;
  };
  flowFactors: Record<string, Record<string, number>>;
}

export function balanceLines(
  lines: AssemblyLine[],
  globalConstraints: { totalFtePool: number; demand: number; availableHours: number }
): BalancerResult {
  const { totalFtePool, demand, availableHours } = globalConstraints;
  const availableMinutes = availableHours * 60;
  const taktTime = availableMinutes / demand;

  // Clone lines to avoid mutating original state
  const balancedLines: AssemblyLine[] = JSON.parse(JSON.stringify(lines));

  // 1. Calculate flow factors for all stations in all lines
  const allStations: { lineId: string; station: Station; flowFactor: number }[] = [];
  const lineFlowFactors: Record<string, Record<string, number>> = {};
  const lineMachineMaxLoad: Record<string, number> = {};

  balancedLines.forEach(line => {
    const flowFactors: Record<string, number> = {};
    line.stations.forEach(s => {
      const isEntry = !line.connections.some(c => c.targetId === s.id && !c.isRework);
      flowFactors[s.id] = isEntry ? 1.0 : 0;
    });

    for (let i = 0; i < 20; i++) {
      line.stations.forEach(s => {
        const incoming = line.connections.filter(c => c.targetId === s.id);
        if (incoming.length > 0) {
          let newFactor = 0;
          const isEntry = !line.connections.some(c => c.targetId === s.id && !c.isRework);
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

    let maxMachineLoad = 0;
    line.stations.forEach(s => {
      if (s.type === 'machine' && !s.isKanbanSource) {
        const ff = flowFactors[s.id] || 0;
        const load = (s.cycleTime / (s.batchSize || 1)) * ff;
        if (load > maxMachineLoad) maxMachineLoad = load;
      } else if (s.type !== 'inventory' && !s.isKanbanSource) {
        allStations.push({ lineId: line.id, station: s, flowFactor: flowFactors[s.id] || 0 });
      }
    });
    lineFlowFactors[line.id] = flowFactors;
    lineMachineMaxLoad[line.id] = maxMachineLoad;
  });

  // 2. Initial assignment: minFteRequired
  let totalAssigned = 0;
  allStations.forEach(item => {
    const minFte = Math.max(1, item.station.minFteRequired || 1);
    item.station.fte = minFte;
    totalAssigned += minFte;
  });

  let remainingFte = totalFtePool - totalAssigned;

  // 3. Iteratively assign fte to the most constrained stations
  if (remainingFte > 0) {
    const increments = remainingFte * 2;
    for (let i = 0; i < increments; i++) {
      let worstStation: { lineId: string; station: Station; flowFactor: number } | null = null;
      let worstLoad = -1;

      allStations.forEach(item => {
        const currentFte = item.station.fte;
        const maxAllowed = Math.min(
          item.station.maxFteAllowed || 1000,
          item.station.trainedFteAvailable || 1000
        );
        
        if (currentFte < maxAllowed) {
          const currentLoad = (item.station.cycleTime / currentFte) * item.flowFactor;
          const machineBottleneck = lineMachineMaxLoad[item.lineId] || 0;
          const targetLoad = Math.max(machineBottleneck, taktTime);
          
          // Only add fte if it improves the line (load > targetLoad)
          if (currentLoad > targetLoad && currentLoad > worstLoad) {
            worstLoad = currentLoad;
            worstStation = item;
          }
        }
      });

      if (worstStation) {
        worstStation.station.fte += 0.5;
      } else {
        break; // All stations reached max allowed, or line is bottlenecked by machine/demand
      }
    }
  }

  // Calculate high-level metrics for the result
  let totalFteUsed = 0;
  let totalOutput = 0;
  let totalEfficiency = 0;

  balancedLines.forEach(line => {
    let maxLoad = 0;
    let lineFte = 0;
    let totalEffectiveCT = 0;

    line.stations.forEach(s => {
      if (s.type === 'inventory' || s.isKanbanSource) return;
      
      const ff = lineFlowFactors[line.id][s.id] || 0;
      let effectiveCT = 0;
      let fte = 0;

      if (s.type === 'machine' && !s.isKanbanSource) {
        effectiveCT = s.cycleTime / (s.batchSize || 1);
      } else if (s.type !== 'machine' && !s.isKanbanSource) {
        fte = s.fte;
        effectiveCT = s.cycleTime / fte;
        lineFte += fte;
      }
      
      const load = effectiveCT * ff;
      
      totalEffectiveCT += effectiveCT;
      if (load > maxLoad) maxLoad = load;
    });

    totalFteUsed += lineFte;
    const output = maxLoad > 0 ? Math.floor(availableMinutes / maxLoad) : 0;
    totalOutput += output;
    
    const efficiency = (maxLoad > 0 && lineFte > 0) 
      ? (totalEffectiveCT / (maxLoad * lineFte)) * 100 
      : 0;
    totalEfficiency += efficiency;
  });

  return {
    lines: balancedLines,
    metrics: {
      totalFteUsed,
      totalOutput,
      averageEfficiency: balancedLines.length > 0 ? totalEfficiency / balancedLines.length : 0
    },
    flowFactors: lineFlowFactors
  };
}
