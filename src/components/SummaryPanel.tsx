import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';
import { Metrics, Station, GlobalSettings, Connection } from '../types';
import { MetricCard } from './MetricCard';
import { AlertCircle, Info } from 'lucide-react';

interface SummaryPanelProps {
  metrics: Metrics;
  stations: Station[];
  connections: Connection[];
  settings: GlobalSettings;
  height: number;
}

export function SummaryPanel({ metrics, stations, connections, settings, height }: SummaryPanelProps) {
  const chartData = stations.map(s => {
    const flowFactor = metrics.flowFactors?.[s.id] || 0;
    const isAutoBalanced = s.isAutoBalanced || settings.autoBalanceAll;
    const workers = isAutoBalanced 
      ? Math.max(1, Math.ceil((s.cycleTime * flowFactor) / metrics.adjustedTakt))
      : s.workers;
    const effectiveCT = s.cycleTime / workers;
    const load = effectiveCT * flowFactor;
    
    return {
      name: s.name,
      load: Number(load.toFixed(2)),
      isBottleneck: s.id === metrics.bottleneckStationId,
      isInventory: s.type === 'inventory'
    };
  }).filter(d => !d.isInventory);

  const getSplitSum = (stationId: string) => {
    return connections
      .filter(c => c.sourceId === stationId && !c.isRework)
      .reduce((sum, c) => sum + c.splitPercent, 0);
  };

  const validationErrors = stations.flatMap(s => {
    const errors = [];
    const splitSum = getSplitSum(s.id);
    const hasOutgoing = connections.some(c => c.sourceId === s.id && !c.isRework);
    
    if (hasOutgoing && splitSum !== 100) {
      errors.push({
        id: `split-${s.id}`,
        station: s.name,
        message: `Outgoing split percentages sum to ${splitSum}%. They should sum to 100%.`,
        type: 'error'
      });
    }

    if (s.type === 'inventory' && (s.targetInventory || 0) > (s.capacity || 0)) {
      errors.push({
        id: `inv-${s.id}`,
        station: s.name,
        message: `Target inventory (${s.targetInventory}) exceeds capacity (${s.capacity}).`,
        type: 'warning'
      });
    }

    return errors;
  });

  return (
    <div style={{ height }} className="bg-white border-t border-slate-200 flex flex-col z-10">
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/3 p-4 grid grid-cols-2 gap-3 border-r border-slate-100 overflow-y-auto">
          <MetricCard 
            label="Output" 
            value={`${metrics.lineOutput} u/d`} 
            sub="Units per day" 
            tooltip="The maximum number of units the line can produce per day, limited by the bottleneck station."
            tooltipPosition="bottom"
          />
          <MetricCard 
            label="Takt" 
            value={`${metrics.taktTime.toFixed(1)}m`} 
            sub="Target pace" 
            tooltip="The maximum time allowed to produce one unit to meet demand (Available Time / Demand)."
            tooltipPosition="bottom"
          />
          <MetricCard 
            label="Lead Time" 
            value={`${metrics.leadTime.toFixed(1)}m`} 
            sub="Total flow" 
            tooltip="The total time it takes for one unit to travel from the first station to the last (longest path)."
          />
          <MetricCard 
            label="Efficiency" 
            value={`${metrics.lineEfficiency.toFixed(1)}%`} 
            sub="Balance" 
            tooltip="How well the line is balanced. 100% means all stations have exactly the same load."
          />
          <MetricCard 
            label="WIP" 
            value={`${metrics.wip.toFixed(1)}u`} 
            sub="Units in line" 
            tooltip="The average number of units currently being processed on the line."
          />
          <MetricCard 
            label="VA Time" 
            value={`${metrics.vaTime.toFixed(1)}m`} 
            sub="Value Added" 
            tooltip="The total time spent actually processing the product at stations on the critical path."
          />
          <MetricCard 
            label="NVA Time" 
            value={`${metrics.nvaTime.toFixed(1)}m`} 
            sub="Non-Value Added" 
            tooltip="The total time spent waiting in buffers on the critical path."
          />
          <MetricCard 
            label="Efficiency (PCE)" 
            value={`${metrics.pce.toFixed(1)}%`} 
            sub="Process Cycle" 
            tooltip="Process Cycle Efficiency (VA Time / Total Lead Time). Higher is better."
          />
        </div>

        <div className="flex-1 p-4 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Station Balance Chart</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase">Station Load</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase">Bottleneck</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-px bg-red-400 border-t border-dashed border-red-400" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Takt Time</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                  interval={0}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <ReferenceLine 
                  y={metrics.adjustedTakt} 
                  stroke="#f87171" 
                  strokeDasharray="4 4" 
                  strokeWidth={2}
                />
                <Bar dataKey="load" radius={[4, 4, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isBottleneck ? '#f97316' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Validation & Boundaries Sidebar */}
        <div className="w-1/4 p-4 border-l border-slate-100 overflow-y-auto bg-slate-50/50 flex flex-col gap-6">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Workforce</h3>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Total Workers</span>
                <span className="text-sm font-mono font-bold text-blue-600">{metrics.totalWorkers}</span>
              </div>
              <div className="space-y-1">
                {stations.filter(s => s.type !== 'inventory').map(s => {
                  const workers = (s.isAutoBalanced || settings.autoBalanceAll)
                    ? (metrics.finalWorkers?.[s.id] || 1)
                    : s.workers;
                  return (
                    <div key={s.id} className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-600 truncate">{s.name}</span>
                      <span className="font-mono font-bold text-slate-700">{workers}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Improvements</h3>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-[10px] text-slate-600 space-y-2">
              {metrics.bottleneckStationId ? (
                <p>Optimize bottleneck: <span className="font-bold text-amber-600">{stations.find(s => s.id === metrics.bottleneckStationId)?.name}</span></p>
              ) : (
                <p>Line is well balanced.</p>
              )}
              {metrics.lineEfficiency < 80 && <p>Efficiency low: Consider rebalancing.</p>}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Critical Issues</h3>
            {validationErrors.length > 0 ? (
              <div className="space-y-2">
                {validationErrors.map(err => (
                  <div key={err.id} className="bg-red-50 p-2 rounded-lg border border-red-100 flex gap-2 items-start">
                    <AlertCircle size={10} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-red-700 font-medium leading-tight">{err.station}: {err.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 p-2 rounded-lg border border-green-100 text-[9px] text-green-700 font-medium">
                No critical issues detected.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
