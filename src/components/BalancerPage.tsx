import React, { useState, useMemo } from 'react';
import { AssemblyLine, GlobalSettings } from '../types';
import { balanceLines, BalancerResult } from '../utils/balancer';
import { Users, Target, Clock, Play, Download, ArrowLeft, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';
import { TooltipWrapper } from './TooltipWrapper';

interface BalancerPageProps {
  lines: AssemblyLine[];
  settings: GlobalSettings;
  onBack: () => void;
  onApply: (lines: AssemblyLine[]) => void;
}

export function BalancerPage({ lines, settings, onBack, onApply }: BalancerPageProps) {
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set(lines.map(l => l.id)));
  const [ftePerLine, setFtePerLine] = useState<Record<string, number>>(
    Object.fromEntries(lines.map(l => [l.id, 10]))
  );
  const [demand, setDemand] = useState<number>(settings.demand);
  const [availableHours, setAvailableHours] = useState<number>(settings.availableHours);
  const [result, setResult] = useState<BalancerResult | null>(null);
  const [baselineResult, setBaselineResult] = useState<BalancerResult | null>(null);
  const [laborCost, setLaborCost] = useState<number>(25);
  const [productValue, setProductValue] = useState<number>(100);

  const handleToggleLine = (id: string) => {
    const newSet = new Set(selectedLineIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedLineIds(newSet);
  };

  const handleRunOptimization = () => {
    const selectedLines = lines.filter(l => selectedLineIds.has(l.id));
    
    // Balance each line independently
    const optimizedLines: AssemblyLine[] = [];
    let totalFteUsed = 0;
    let totalOutput = 0;
    let totalEfficiency = 0;
    const allFlowFactors: Record<string, Record<string, number>> = {};

    selectedLines.forEach(line => {
      const lineFte = ftePerLine[line.id] || 0;
      const lineResult = balanceLines([line], {
        totalFtePool: lineFte,
        demand,
        availableHours
      });
      
      optimizedLines.push(lineResult.lines[0]);
      totalFteUsed += lineResult.metrics.totalFteUsed;
      totalOutput += lineResult.metrics.totalOutput;
      totalEfficiency += lineResult.metrics.averageEfficiency;
      Object.assign(allFlowFactors, lineResult.flowFactors);
    });

    setResult({
      lines: optimizedLines,
      metrics: {
        totalFteUsed,
        totalOutput,
        averageEfficiency: selectedLines.length > 0 ? totalEfficiency / selectedLines.length : 0
      },
      flowFactors: allFlowFactors
    });
  };

  const handleApply = () => {
    if (!result) return;
    
    // Merge optimized lines back into the full list
    const newLines = lines.map(originalLine => {
      const optimizedLine = result.lines.find(l => l.id === originalLine.id);
      return optimizedLine || originalLine;
    });
    
    onApply(newLines);
    onBack();
  };

  const handleExportJSON = () => {
    if (!result) return;
    const data = JSON.stringify({ lines: result.lines, settings: { demand, availableHours } }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Optimized_Lines.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Global Line Balancer</h1>
            <p className="text-sm text-slate-500">Optimize worker distribution across multiple lines</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {result && (
            <>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50"
              >
                <Download size={16} />
                Export JSON
              </button>
              <button
                onClick={handleApply}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700"
              >
                <CheckCircle2 size={16} />
                Apply to Editor
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Configuration */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
          <div className="p-6 space-y-8">
            {/* Global Constraints */}
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Global Constraints</h2>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <Target size={16} className="text-orange-500" />
                    Target Daily Output
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    value={demand}
                    onChange={e => setDemand(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <Clock size={16} className="text-purple-500" />
                    Shift Hours
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    value={availableHours}
                    onChange={e => setAvailableHours(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Line Selection & Worker Allocation */}
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Select Lines & Workers</h2>
              <div className="space-y-3">
                {lines.map(line => (
                  <div key={line.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedLineIds.has(line.id)}
                        onChange={() => handleToggleLine(line.id)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <span className="text-sm font-bold text-slate-700">{line.name}</span>
                    </label>
                    {selectedLineIds.has(line.id) && (
                      <div className="flex items-center gap-2 pl-7">
                        <Users size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workers:</span>
                        <input 
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={ftePerLine[line.id] || 0}
                          onChange={e => setFtePerLine(prev => ({ ...prev, [line.id]: Math.max(0, Number(e.target.value)) }))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ROI Calculator */}
            <section className="border-t border-slate-200 pt-8">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">ROI Calculator</h2>
              <div className="space-y-4">
                <div>
                  <TooltipWrapper content="Hourly cost of labor for one worker">
                    <label className="text-sm font-bold text-slate-700 mb-1.5">Labor Cost ($/hr)</label>
                  </TooltipWrapper>
                  <input 
                    type="number" 
                    value={laborCost}
                    onChange={e => setLaborCost(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <TooltipWrapper content="Selling price or value of one finished unit">
                    <label className="text-sm font-bold text-slate-700 mb-1.5">Product Value ($)</label>
                  </TooltipWrapper>
                  <input 
                    type="number" 
                    value={productValue}
                    onChange={e => setProductValue(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <TooltipWrapper content="Save current optimization as baseline for ROI comparison">
                  <button
                    onClick={() => setBaselineResult(result)}
                    disabled={!result}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-2 rounded-lg font-bold hover:bg-slate-900 disabled:opacity-50 transition-colors"
                  >
                    Save as Baseline
                  </button>
                </TooltipWrapper>
              </div>
            </section>

            <button
              onClick={handleRunOptimization}
              disabled={selectedLineIds.size === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
            >
              <Play size={18} />
              Run Optimization
            </button>
          </div>
        </div>

        {/* Main Content - Results */}
        <div className="flex-1 p-8 overflow-y-auto">
          {!result ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                <Target size={32} strokeWidth={1.5} />
              </div>
              <p className="text-lg font-medium text-slate-500">Configure constraints and run optimization to see results.</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-8">
              {/* KPI Dashboard */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-sm font-bold text-slate-500 mb-2">Lines Meeting Target</div>
                  <div className="text-3xl font-mono font-bold text-slate-800">
                    {(() => {
                      const taktTime = (availableHours * 60) / demand;
                      return result.lines.filter(line => {
                        let maxLoad = 0;
                        const lineFlowFactors = result.flowFactors[line.id] || {};
                        line.stations.forEach(s => {
                          if (s.type === 'inventory') return;
                          const ff = lineFlowFactors[s.id] || 0;
                          const effectiveCT = s.type === 'machine' ? s.cycleTime / (s.batchSize || 1) : s.cycleTime / s.fte;
                          const load = effectiveCT * ff;
                          if (load > maxLoad) maxLoad = load;
                        });
                        return maxLoad <= taktTime && maxLoad > 0;
                      }).length;
                    })()} <span className="text-lg text-slate-400">/ {result.lines.length}</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-sm font-bold text-slate-500 mb-2">Total FTE Used</div>
                  <div className="text-3xl font-mono font-bold text-blue-600">{result.metrics.totalFteUsed}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-sm font-bold text-slate-500 mb-2">Avg Efficiency</div>
                  <div className="text-3xl font-mono font-bold text-green-600">{result.metrics.averageEfficiency.toFixed(1)}<span className="text-lg text-slate-400">%</span></div>
                </div>
              </div>

              {/* ROI Dashboard */}
              {baselineResult && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4">ROI Impact Analysis</h3>
                  <div className="grid grid-cols-3 gap-6">
                    {(() => {
                      const currentRevenue = result.metrics.totalOutput * productValue;
                      const baselineRevenue = baselineResult.metrics.totalOutput * productValue;
                      const currentCost = result.metrics.totalFteUsed * laborCost * availableHours;
                      const baselineCost = baselineResult.metrics.totalFteUsed * laborCost * availableHours;
                      
                      const outputDiff = ((result.metrics.totalOutput - baselineResult.metrics.totalOutput) / baselineResult.metrics.totalOutput) * 100;
                      const profitDiff = (currentRevenue - currentCost) - (baselineRevenue - baselineCost);

                      return (
                        <>
                          <div className="text-center">
                            <div className="text-sm font-bold text-slate-500 mb-1">Output Change</div>
                            <div className={`text-2xl font-mono font-bold ${outputDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {outputDiff >= 0 ? '+' : ''}{outputDiff.toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-slate-500 mb-1">Profit Impact</div>
                            <div className={`text-2xl font-mono font-bold ${profitDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {profitDiff >= 0 ? '+' : ''}${profitDiff.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-slate-500 mb-1">FTE Efficiency</div>
                            <div className="text-2xl font-mono font-bold text-blue-600">
                              {(result.metrics.totalOutput / result.metrics.totalFteUsed).toFixed(1)} <span className="text-sm text-slate-400">u/fte</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Calculation Details */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
                <h3 className="font-bold text-slate-800 mb-4">Calculation Details</h3>
                <div className="text-sm text-slate-600 space-y-2">
                  <p><strong>Available Time:</strong> {availableHours} hours = {availableHours * 60} minutes</p>
                  <p><strong>Takt Time:</strong> {availableHours * 60} mins / {demand} units = {((availableHours * 60) / demand).toFixed(2)} mins/unit</p>
                  <p><strong>Optimization Strategy:</strong> The balancer iteratively assigns FTE to the most constrained stations (highest effective cycle time) across all selected lines, respecting the maximum FTE allowed per station, until the total FTE pool is exhausted.</p>
                  <p><strong>Machine Stations & Capacity:</strong> Machines do not consume FTE. Their effective cycle time is calculated as <code>Cycle Time / Capacity</code>. If a machine becomes the absolute bottleneck of a line, the balancer will stop adding FTE to manual stations on that line, as it won't increase the overall output.</p>
                  <p><strong>Target Demand Limit:</strong> The balancer will stop adding FTE to a line if it already meets the Target Daily Output, saving labor costs.</p>
                  <p><strong>Trained Staff & Min FTE:</strong> The balancer respects the minimum FTE required for safety/operation and will not exceed the available trained staff for a specific station.</p>
                </div>
              </div>

              {/* Line Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="font-bold text-slate-800">Line Breakdown</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {result.lines.map(line => {
                    const fte = line.stations.reduce((sum, s) => sum + (s.type !== 'inventory' && s.type !== 'machine' ? s.fte : 0), 0);
                    
                    // Calculate line metrics
                    const lineFlowFactors = result.flowFactors[line.id] || {};
                    let maxLoad = 0;
                    let totalEffectiveCT = 0;
                    let lineFte = 0;
                    
                    const chartData = line.stations.filter(s => s.type !== 'inventory').map(s => {
                      const ff = lineFlowFactors[s.id] || 0;
                      let effectiveCT = 0;
                      if (s.type === 'machine') {
                        effectiveCT = s.cycleTime / (s.batchSize || 1);
                      } else {
                        effectiveCT = s.cycleTime / s.fte;
                        lineFte += s.fte;
                      }
                      
                      const load = effectiveCT * ff;
                      totalEffectiveCT += effectiveCT;
                      if (load > maxLoad) maxLoad = load;
                      
                      return {
                        id: s.id,
                        name: s.name,
                        load: Number(load.toFixed(2)),
                        isMachine: s.type === 'machine'
                      };
                    }).map(d => ({
                      ...d,
                      isBottleneck: d.load === maxLoad && d.load > 0
                    }));
                    
                    const output = maxLoad > 0 ? Math.floor((availableHours * 60) / maxLoad) : 0;
                    const efficiency = (maxLoad > 0 && lineFte > 0) ? (totalEffectiveCT / (maxLoad * lineFte)) * 100 : 0;
                    const taktTime = demand > 0 ? (availableHours * 60) / demand : 0;

                    return (
                      <div key={line.id} className="p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-800 text-lg">{line.name}</h4>
                            <div className="flex items-center gap-4 mt-1">
                              <p className="text-sm text-slate-500">{line.stations.length} stations</p>
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px] font-bold uppercase tracking-wider border border-orange-100">
                                <Target size={10} />
                                Takt: {taktTime.toFixed(2)}m
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Output</div>
                              <div className="font-mono font-bold text-slate-700 text-xl">{output}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Efficiency</div>
                              <div className="font-mono font-bold text-green-600 text-xl">{efficiency.toFixed(1)}%</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">FTE</div>
                              <div className="font-mono font-bold text-blue-600 text-xl">{fte}</div>
                            </div>
                          </div>
                        </div>

                        {/* Chart */}
                        <div className="h-64 mt-6 mb-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis 
                                dataKey="name" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                                dy={10}
                              />
                              <YAxis 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                domain={[0, Math.max(...chartData.map(d => d.load), taktTime) * 1.1]}
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
                                y={taktTime} 
                                stroke="#f87171" 
                                strokeDasharray="4 4" 
                                strokeWidth={2}
                                label={{ position: 'top', value: 'Takt', fill: '#f87171', fontSize: 10, fontWeight: 'bold' }}
                              />
                              <Bar dataKey="load" radius={[4, 4, 0, 0]} barSize={40}>
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.isBottleneck ? '#f97316' : (entry.isMachine ? '#a855f7' : '#3b82f6')} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        
                        {/* Station Details */}
                        <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Station Allocations & Constraints</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {line.stations.filter(s => s.type !== 'inventory').map(s => {
                              const isMachine = s.type === 'machine';
                              const effectiveCT = isMachine ? s.cycleTime / (s.batchSize || 1) : s.cycleTime / s.fte;
                              const ff = lineFlowFactors[s.id] || 0;
                              const load = effectiveCT * ff;
                              const isOverTakt = load > taktTime && taktTime > 0;

                              return (
                                <div key={s.id} className={`bg-white p-3 rounded-lg border shadow-sm flex flex-col gap-2 ${isOverTakt ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-700 text-sm truncate pr-2">{s.name}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isMachine ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                                      {isMachine ? 'Machine' : 'Manual'}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-slate-400">Base C/T:</span>
                                      <span className="ml-1 font-mono font-bold text-slate-700">{s.cycleTime}m</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Load:</span>
                                      <span className={`ml-1 font-mono font-bold ${isOverTakt ? 'text-red-600' : 'text-slate-700'}`}>
                                        {load.toFixed(1)}m
                                      </span>
                                    </div>
                                    {!isMachine && (
                                      <>
                                        <div>
                                          <span className="text-slate-400">Workers:</span>
                                          <span className="ml-1 font-mono font-bold text-blue-600">{s.fte}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-400">Min W:</span>
                                          <span className="ml-1 font-mono font-bold text-slate-700">{s.minWorkersRequired || 1}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-400">Max W:</span>
                                          <span className="ml-1 font-mono font-bold text-slate-700">{s.maxWorkersAllowed || '∞'}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-400">Trained:</span>
                                          <span className="ml-1 font-mono font-bold text-slate-700">{s.trainedWorkersAvailable || '∞'}</span>
                                        </div>
                                      </>
                                    )}
                                    {isMachine && (
                                      <>
                                        <div>
                                          <span className="text-slate-400">Capacity:</span>
                                          <span className="ml-1 font-mono font-bold text-slate-700">{s.capacity || 0}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-400">Batch:</span>
                                          <span className="ml-1 font-mono font-bold text-slate-700">{s.batchSize || 1}</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
