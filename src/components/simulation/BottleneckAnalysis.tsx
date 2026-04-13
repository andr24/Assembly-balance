import React from 'react';
import { Flame, ShieldAlert, Zap, Gauge } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottleneckItem {
  id: string;
  name: string;
  utilization: number;
  starvation: number;
  blockage: number;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

interface BottleneckAnalysisProps {
  bottleneckAnalysis: BottleneckItem[];
}

export function BottleneckAnalysis({ bottleneckAnalysis }: BottleneckAnalysisProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Flame size={18} className="text-orange-600" />
          Bottleneck & Constraint Analysis
        </h3>
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5 text-red-600">
            <div className="w-2 h-2 rounded-full bg-red-600" />
            Critical
          </div>
          <div className="flex items-center gap-1.5 text-amber-600">
            <div className="w-2 h-2 rounded-full bg-amber-600" />
            Warning
          </div>
          <div className="flex items-center gap-1.5 text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-600" />
            Balanced
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bottleneckAnalysis.map((item) => (
          <div 
            key={item.id}
            className={cn(
              "p-4 rounded-xl border transition-all",
              item.severity === 'high' ? "bg-red-50 border-red-100" : 
              item.severity === 'medium' ? "bg-amber-50 border-amber-100" : 
              "bg-slate-50 border-slate-100"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
                    item.severity === 'high' ? "bg-red-200 text-red-700" : 
                    item.severity === 'medium' ? "bg-amber-200 text-amber-700" : 
                    "bg-green-200 text-green-700"
                  )}>
                    {item.severity === 'high' ? "Bottleneck" : item.severity === 'medium' ? "Constraint" : "Balanced"}
                  </span>
                </div>
              </div>
              <div className={cn(
                "p-2 rounded-lg",
                item.severity === 'high' ? "bg-red-100 text-red-600" : 
                item.severity === 'medium' ? "bg-amber-100 text-amber-600" : 
                "bg-green-100 text-green-600"
              )}>
                {item.severity === 'high' ? <ShieldAlert size={18} /> : 
                 item.severity === 'medium' ? <Zap size={18} /> : 
                 <Gauge size={18} />}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Utilization</span>
                <span className="text-xs font-mono font-bold text-slate-700">{item.utilization.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    item.severity === 'high' ? "bg-red-500" : 
                    item.severity === 'medium' ? "bg-amber-500" : 
                    "bg-green-500"
                  )}
                  style={{ width: `${item.utilization}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-2">
                {item.reason}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
