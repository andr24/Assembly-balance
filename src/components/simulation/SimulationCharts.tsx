import React from 'react';
import { TrendingUp, Activity, AlertTriangle, Package } from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend, 
  LineChart, 
  Line 
} from 'recharts';
import { AssemblyLine } from '../../types';

interface SimulationChartsProps {
  outputData: any[];
  utilizationData: any[];
  defectsData: any[];
  inventoryData: any[];
  selectedLine: AssemblyLine | undefined;
  stepMinutes: number;
}

export function SimulationCharts({
  outputData,
  utilizationData,
  defectsData,
  inventoryData,
  selectedLine,
  stepMinutes
}: SimulationChartsProps) {
  const formatMinutes = (mStr: string) => {
    const m = parseInt(mStr);
    if (isNaN(m)) return mStr;
    const day = Math.floor(m / 1440);
    const mins = m % 1440;
    const h = Math.floor(mins / 60);
    const mm = mins % 60;
    return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}${day > 0 ? ` (+${day}d)` : ''}`;
  };

  return (
    <div className="space-y-8">
      {/* Hourly Output Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" />
            Output Trend ({stepMinutes}m steps)
          </h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={outputData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10 }} 
                tickFormatter={formatMinutes}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                labelFormatter={formatMinutes}
              />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} name="Total Output" />
              <Area type="monotone" dataKey="incremental" stroke="#10b981" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" name="Step Output" />
              <Area type="monotone" dataKey="defects" stroke="#ef4444" fillOpacity={0} strokeWidth={2} name="Step Defects" />
              <Area type="monotone" dataKey="rework" stroke="#f59e0b" fillOpacity={0} strokeWidth={2} name="Step Rework" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Station Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Activity size={18} className="text-purple-500" />
            Station Utilization & Losses
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="utilization" stackId="a" fill="#3b82f6" name="Working %" radius={[0, 0, 0, 0]} />
                <Bar dataKey="starvation" stackId="a" fill="#ef4444" name="Starved %" />
                <Bar dataKey="blockage" stackId="a" fill="#f59e0b" name="Blocked %" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Defects by Station
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={defectsData} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="defects" fill="#ef4444" radius={[4, 4, 0, 0]} name="Defects (On-spot)" />
                <Bar dataKey="rework" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Rework (Loop)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Package size={18} className="text-orange-500" />
          Inventory Levels Over Time
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={inventoryData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10 }} 
                tickFormatter={formatMinutes}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                labelFormatter={formatMinutes}
              />
              <Legend />
              {selectedLine?.stations.map((s, i) => (
                <Line 
                  key={s.id} 
                  type="monotone" 
                  dataKey={s.name} 
                  stroke={`hsl(${i * 137.5}, 70%, 50%)`} 
                  strokeWidth={2} 
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
