import React from 'react';
import { InfoTooltip } from './InfoTooltip';

export function MetricCard({ label, value, sub, tooltip, tooltipPosition = 'top' }: { label: string; value: string | number; sub: string; tooltip?: string; tooltipPosition?: 'top' | 'bottom' }) {
  return (
    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors group relative">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">{label}</p>
        {tooltip && <InfoTooltip content={tooltip} position={tooltipPosition} />}
      </div>
      <p className="text-lg font-mono font-bold text-slate-700">{value}</p>
      <p className="text-[9px] text-slate-400 font-medium">{sub}</p>
    </div>
  );
}
