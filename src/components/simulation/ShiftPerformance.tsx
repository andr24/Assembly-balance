import React from 'react';
import { Activity } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface ShiftMetric {
  dayIndex: number;
  shiftIndex: number;
  shiftName: string;
  weekday: string;
  output: number;
  defects: number;
  rework: number;
}

interface ShiftPerformanceProps {
  shiftMetrics: ShiftMetric[];
}

export function ShiftPerformance({ shiftMetrics }: ShiftPerformanceProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Activity size={18} className="text-emerald-500" />
        Shift Performance Breakdown
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={shiftMetrics}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="shiftName" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              label={{ value: 'Shifts', position: 'insideBottom', offset: -5 }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              formatter={(value: any, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
            />
            <Legend />
            <Bar dataKey="output" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Output" />
            <Bar dataKey="defects" fill="#ef4444" radius={[4, 4, 0, 0]} name="Defects" />
            <Bar dataKey="rework" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Rework" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
