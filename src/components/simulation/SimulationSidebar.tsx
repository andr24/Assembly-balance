import React from 'react';
import { Clock, Activity, AlertTriangle, Zap, Info } from 'lucide-react';
import { AssemblyLine } from '../../types';
import { TooltipWrapper } from './TooltipWrapper';
import { cn } from '../../lib/utils';

interface SimulationSidebarProps {
  selectedLineId: string;
  setSelectedLineId: (id: string) => void;
  localLines: AssemblyLine[];
  isSimulating: boolean;
  hasResult: boolean;
  durationHours: number;
  setDurationHours: (h: number) => void;
  stepMinutes: number;
  setStepMinutes: (m: number) => void;
  variability: number;
  setVariability: (v: number) => void;
  enableRework: boolean;
  setEnableRework: (e: boolean) => void;
  onRunMonteCarlo: () => void;
}

export function SimulationSidebar({
  selectedLineId,
  setSelectedLineId,
  localLines,
  isSimulating,
  hasResult,
  durationHours,
  setDurationHours,
  stepMinutes,
  setStepMinutes,
  variability,
  setVariability,
  enableRework,
  setEnableRework,
  onRunMonteCarlo
}: SimulationSidebarProps) {
  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
      <div className="p-6 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Simulation Setup</h2>
            {isSimulating && hasResult && (
              <div className="flex items-center gap-1.5 text-blue-600 animate-pulse">
                <div className="w-2 h-2 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Calculating...</span>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Select Line</label>
              <select 
                value={selectedLineId}
                onChange={e => setSelectedLineId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {localLines.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <TooltipWrapper content="Total time to run the simulation for">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                  <Clock size={16} className="text-blue-500" />
                  Duration (Hours)
                </label>
              </TooltipWrapper>
              <input 
                type="number" 
                min="1"
                value={durationHours}
                onChange={e => setDurationHours(Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <TooltipWrapper content="Frequency of data collection snapshots">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                  <Activity size={16} className="text-purple-500" />
                  Snapshot Interval (Min)
                </label>
              </TooltipWrapper>
              <input 
                type="number" 
                min="1"
                value={stepMinutes}
                onChange={e => setStepMinutes(Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <TooltipWrapper content="Random variation added to cycle times">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <AlertTriangle size={16} className="text-amber-500" />
                    Variability
                  </label>
                </TooltipWrapper>
                <span className="text-xs font-mono font-bold text-amber-600">{variability}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="50" 
                step="5"
                value={variability}
                onChange={e => setVariability(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <p className="text-[10px] text-slate-400 mt-1 italic">Simulates random fluctuations in cycle times.</p>
            </div>

            <TooltipWrapper content="Run 100 simulation iterations to assess performance variability and risk">
              <button
                onClick={onRunMonteCarlo}
                disabled={isSimulating}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-purple-200 mt-4"
              >
                <Zap size={18} />
                Run Monte Carlo (100x)
              </button>
            </TooltipWrapper>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-slate-700">Enable Rework</label>
                <TooltipWrapper content="If enabled, defective units will be sent back to the previous station. If no rework loop exists, cycle time increases to fix the unit.">
                  <Info size={14} className="text-slate-400" />
                </TooltipWrapper>
              </div>
              <button
                onClick={() => setEnableRework(!enableRework)}
                className={cn(
                  "w-10 h-5 rounded-full transition-colors relative",
                  enableRework ? "bg-blue-600" : "bg-slate-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                  enableRework ? "left-6" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
