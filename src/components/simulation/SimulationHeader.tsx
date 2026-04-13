import React from 'react';
import { ArrowLeft, Clock } from 'lucide-react';

interface SimulationHeaderProps {
  onBack: () => void;
  onOpenSchedule: () => void;
  durationHours: number;
}

export function SimulationHeader({ onBack, onOpenSchedule, durationHours }: SimulationHeaderProps) {
  const totalMinutes = durationHours * 60;
  const days = Math.floor(durationHours / 24);
  const remainingHours = durationHours % 24;

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Production Simulator</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-sm text-slate-500">Dynamic digital twin of your assembly line</p>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
              <Clock size={12} className="text-blue-500" />
              <span>
                Total Simulation: <span className="text-slate-900 font-bold">{totalMinutes.toLocaleString()} min</span>
                {durationHours >= 24 && (
                  <span className="ml-1 text-slate-400 font-normal">
                    ({days}d {remainingHours > 0 ? `${remainingHours}h` : ''})
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
      <button 
        onClick={onOpenSchedule}
        className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-bold transition-all border border-emerald-200"
      >
        <Clock size={18} />
        Schedule
      </button>
    </header>
  );
}
