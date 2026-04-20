import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';
import { Metrics, Station, GlobalSettings, Connection } from '../types';
import { MetricCard } from './MetricCard';
import { AlertCircle, Info, BarChart2, Hash, Sparkles, Loader2, Database } from 'lucide-react';
import { getSimulationInsights, getBufferSuggestions } from '../services/aiService';
import ReactMarkdown from 'react-markdown';

interface SummaryPanelProps {
  metrics: Metrics;
  stations: Station[];
  connections: Connection[];
  settings: GlobalSettings;
  height: number;
}

export function SummaryPanel({ metrics, stations, connections, settings, height }: SummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<'balance' | 'histogram' | 'ai' | 'buffers'>('balance');
  const [insights, setInsights] = useState<string | null>(null);
  const [bufferSuggestions, setBufferSuggestions] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingBuffers, setIsGeneratingBuffers] = useState(false);

  const handleGenerateInsights = async () => {
    setIsGenerating(true);
    setActiveTab('ai');
    try {
      const result = await getSimulationInsights(stations, connections, metrics, settings);
      setInsights(result);
    } catch (error) {
      setInsights("Failed to generate insights. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateBufferSuggestions = async () => {
    setIsGeneratingBuffers(true);
    setActiveTab('buffers');
    try {
      const result = await getBufferSuggestions(stations, connections, metrics, settings);
      setBufferSuggestions(result);
    } catch (error) {
      setBufferSuggestions("Failed to generate buffer suggestions. Please try again.");
    } finally {
      setIsGeneratingBuffers(false);
    }
  };
  const chartData = stations.map(s => {
    const flowFactor = metrics.flowFactors?.[s.id] || 0;
    const effectiveCT = s.type === 'machine' ? s.cycleTime / (s.batchSize || 1) : s.cycleTime / s.fte;
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

  const histogramData = useMemo(() => {
    const activeStations = stations.filter(s => s.type !== 'inventory');
    if (activeStations.length === 0) return [];
    
    const cts = activeStations.map(s => s.cycleTime);
    const min = Math.min(...cts);
    const max = Math.max(...cts);
    const bins = 5;
    const step = (max - min) / bins || 1;
    
    return Array.from({ length: bins }, (_, i) => {
      const low = min + i * step;
      const high = low + step;
      const count = cts.filter(v => v >= low && (i === bins - 1 ? v <= high : v < high)).length;
      return {
        range: `${low.toFixed(1)}-${high.toFixed(1)}`,
        count
      };
    });
  }, [stations]);

  return (
    <div 
      style={{ height: window.innerWidth < 1024 ? 'auto' : height }} 
      className="bg-white border-t border-slate-200 flex flex-col z-10 overflow-y-auto lg:overflow-hidden max-h-[60vh] lg:max-h-none shadow-2xl lg:shadow-none"
    >
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-1/3 p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 border-b lg:border-b-0 lg:border-r border-slate-100 overflow-y-auto">
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

        <div className="flex-1 p-4 flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('balance')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'balance' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart2 size={14} />
                Station Balance
              </button>
              <button
                onClick={() => setActiveTab('histogram')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'histogram' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Hash size={14} />
                CT Distribution
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'ai' 
                    ? 'bg-white text-emerald-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sparkles size={14} />
                AI Insights
              </button>
              <button
                onClick={() => setActiveTab('buffers')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'buffers' 
                    ? 'bg-white text-amber-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Database size={14} />
                Buffer Suggestions
              </button>
            </div>

            {activeTab === 'balance' && (
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
            )}
          </div>

          <div className="flex-1 min-h-[300px] lg:min-h-0">
            {activeTab === 'balance' ? (
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
            ) : activeTab === 'histogram' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="range" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
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
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            ) : activeTab === 'ai' ? (
              <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
                {isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                    <p className="text-sm font-bold animate-pulse">Analyzing simulation results...</p>
                  </div>
                ) : insights ? (
                  <div className="prose prose-sm prose-slate max-w-none">
                    <ReactMarkdown>{insights}</ReactMarkdown>
                    <button 
                      onClick={handleGenerateInsights}
                      className="mt-6 flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-[10px] font-bold uppercase tracking-widest transition-colors"
                    >
                      <Sparkles size={14} />
                      Refresh Insights
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-full">
                      <Sparkles className="text-emerald-500" size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-600">AI-Powered Analysis</p>
                      <p className="text-xs text-slate-400 mt-1">Get expert suggestions to optimize your production line.</p>
                    </div>
                    <button 
                      onClick={handleGenerateInsights}
                      className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                    >
                      Generate Insights
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
                {isGeneratingBuffers ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Loader2 className="animate-spin text-amber-500" size={32} />
                    <p className="text-sm font-bold animate-pulse">Calculating buffer optimizations...</p>
                  </div>
                ) : bufferSuggestions ? (
                  <div className="prose prose-sm prose-slate max-w-none">
                    <ReactMarkdown>{bufferSuggestions}</ReactMarkdown>
                    <button 
                      onClick={handleGenerateBufferSuggestions}
                      className="mt-6 flex items-center gap-2 text-amber-600 hover:text-amber-700 text-[10px] font-bold uppercase tracking-widest transition-colors"
                    >
                      <Database size={14} />
                      Recalculate Buffers
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                    <div className="p-4 bg-amber-50 rounded-full">
                      <Database className="text-amber-500" size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-600">Buffer Optimization Suggester</p>
                      <p className="text-xs text-slate-400 mt-1">AI-driven analysis to minimize impact of breakdowns.</p>
                    </div>
                    <button 
                      onClick={handleGenerateBufferSuggestions}
                      className="bg-amber-600 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200"
                    >
                      Analyze Buffers
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Validation & Boundaries Sidebar */}
        <div className="w-full lg:w-1/4 p-4 overflow-y-auto bg-slate-50/50 flex flex-col sm:flex-row lg:flex-col gap-6">
          <div className="flex-1">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Workforce</h3>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Total FTE</span>
                <span className="text-sm font-mono font-bold text-blue-600">{metrics.totalFTE}</span>
              </div>
              <div className="space-y-1">
                {stations.filter(s => s.type !== 'inventory').map(s => {
                  const fte = s.type === 'machine' ? '-' : s.fte;
                  return (
                    <div key={s.id} className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-600 truncate">{s.name}</span>
                      <span className="font-mono font-bold text-slate-700">{fte}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Improvements</h3>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-[10px] text-slate-600 space-y-3">
              {metrics.bottleneckStationId ? (
                <p>Optimize bottleneck: <span className="font-bold text-amber-600">{stations.find(s => s.id === metrics.bottleneckStationId)?.name}</span></p>
              ) : (
                <p>Line is well balanced.</p>
              )}
              {metrics.lineEfficiency < 80 && <p>Efficiency low: Consider rebalancing.</p>}
              
              <button 
                onClick={handleGenerateInsights}
                className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 py-2 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors border border-emerald-100"
              >
                <Sparkles size={12} />
                AI Analysis
              </button>
            </div>
          </div>

          <div className="flex-1">
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
