import React from 'react';
import { Zap } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { TooltipWrapper } from './TooltipWrapper';

interface MonteCarloResult {
  mean: number;
  min: number;
  max: number;
  p5: number;
  p95: number;
  outputs: number[];
}

interface MonteCarloResultsProps {
  monteCarloResult: MonteCarloResult;
}

export function MonteCarloResults({ monteCarloResult }: MonteCarloResultsProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <h3 className="font-bold text-slate-800 flex items-center gap-2">
        <Zap size={18} className="text-purple-500" />
        Monte Carlo Analysis (100 Runs)
      </h3>
      <div className="grid grid-cols-5 gap-4">
        <TooltipWrapper content="Average output across all 100 runs">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mean</div>
            <div className="text-2xl font-mono font-bold text-slate-800">{monteCarloResult.mean.toFixed(0)}</div>
          </div>
        </TooltipWrapper>
        <TooltipWrapper content="Worst-case output scenario">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Min</div>
            <div className="text-2xl font-mono font-bold text-red-600">{monteCarloResult.min}</div>
          </div>
        </TooltipWrapper>
        <TooltipWrapper content="Best-case output scenario">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max</div>
            <div className="text-2xl font-mono font-bold text-green-600">{monteCarloResult.max}</div>
          </div>
        </TooltipWrapper>
        <TooltipWrapper content="Lower bound (5% of runs performed worse than this)">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">5th %ile</div>
            <div className="text-2xl font-mono font-bold text-slate-700">{monteCarloResult.p5}</div>
          </div>
        </TooltipWrapper>
        <TooltipWrapper content="Upper bound (95% of runs performed worse than this)">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">95th %ile</div>
            <div className="text-2xl font-mono font-bold text-slate-700">{monteCarloResult.p95}</div>
          </div>
        </TooltipWrapper>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monteCarloResult.outputs.map((o) => ({ output: o }))}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="output" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="output" fill="#a855f7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
