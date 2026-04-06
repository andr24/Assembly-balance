import React from 'react';
import { Info } from 'lucide-react';

export function InfoTooltip({ content, position = 'top' }: { content: string, position?: 'top' | 'bottom' }) {
  return (
    <div className="group/tooltip relative inline-block">
      <Info size={10} className="text-slate-300 hover:text-blue-500 cursor-help transition-colors" />
      <div className={`
        absolute left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg 
        opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-[100] pointer-events-none shadow-xl border border-slate-700
        ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
      `}>
        {content}
        <div className={`
          absolute left-1/2 -translate-x-1/2 border-4 border-transparent
          ${position === 'top' ? 'top-full border-t-slate-800' : 'bottom-full border-b-slate-800'}
        `} />
      </div>
    </div>
  );
}
