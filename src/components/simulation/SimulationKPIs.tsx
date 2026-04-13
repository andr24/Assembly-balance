import React from 'react';
import { TooltipWrapper } from './TooltipWrapper';
import { SimulationResult, SimulationSnapshot } from '../../types';

interface SimulationKPIsProps {
  result: SimulationResult;
  durationHours: number;
  snapshot?: SimulationSnapshot | null;
}

export function SimulationKPIs({ result, durationHours, snapshot }: SimulationKPIsProps) {
  const displayOutput = snapshot ? snapshot.output : result.totalOutput;
  const displayDefects = snapshot ? snapshot.defects : result.totalDefects;
  const displayRework = snapshot ? snapshot.rework : result.totalRework;
  const displayWIP = snapshot ? snapshot.wip : (result.snapshots[result.snapshots.length - 1]?.wip || 0);
  
  const avgUtilization = (Object.values(result.stationUtilization) as number[]).reduce((a: number, b: number) => a + b, 0) / (Object.keys(result.stationUtilization).length || 1);
  const defectRate = (((displayDefects + displayRework) / (displayOutput + displayDefects + displayRework || 1)) * 100);

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
      <TooltipWrapper content="Total units produced by the line">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Output</div>
          <div className="text-2xl font-mono font-bold text-slate-800">{displayOutput} <span className="text-xs text-slate-400 font-sans">u</span></div>
        </div>
      </TooltipWrapper>
      <TooltipWrapper content="Average units produced per hour">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Throughput</div>
          <div className="text-2xl font-mono font-bold text-blue-600">{(displayOutput / durationHours).toFixed(1)} <span className="text-xs text-slate-400 font-sans">u/h</span></div>
        </div>
      </TooltipWrapper>
      <TooltipWrapper content="Total units that failed quality check (either reworked or repaired on-the-spot)">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Defects</div>
          <div className="text-2xl font-mono font-bold text-red-600">{displayDefects} <span className="text-xs text-slate-400 font-sans">u</span></div>
        </div>
      </TooltipWrapper>
      <TooltipWrapper content="Total units that failed quality check but were sent back for rework to a previous station">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Rework</div>
          <div className="text-2xl font-mono font-bold text-amber-600">{displayRework} <span className="text-xs text-slate-400 font-sans">u</span></div>
        </div>
      </TooltipWrapper>
      <TooltipWrapper content="Percentage of total units that were defective">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Defect Rate</div>
          <div className="text-2xl font-mono font-bold text-amber-600">
            {defectRate.toFixed(1)}%
          </div>
        </div>
      </TooltipWrapper>
      <TooltipWrapper content="Work In Progress: Total units currently in the line">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current WIP</div>
          <div className="text-2xl font-mono font-bold text-orange-600">{displayWIP.toFixed(0)} <span className="text-xs text-slate-400 font-sans">u</span></div>
        </div>
      </TooltipWrapper>
    </div>
  );
}
