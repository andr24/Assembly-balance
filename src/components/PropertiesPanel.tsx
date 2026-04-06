import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings2, Zap, Info, ArrowRight, AlertCircle, RefreshCw, Box } from 'lucide-react';
import { Station, Connection, Metrics, GlobalSettings } from '../types';
import { InfoTooltip } from './InfoTooltip';
import { cn } from '../lib/utils';

interface PropertiesPanelProps {
  selectedId: string | null;
  selectedConnId: string | null;
  stations: Station[];
  connections: Connection[];
  metrics: Metrics;
  settings: GlobalSettings;
  updateStation: (id: string, updates: Partial<Station>) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedConnId: (id: string | null) => void;
}

export function PropertiesPanel({
  selectedId,
  selectedConnId,
  stations,
  connections,
  metrics,
  settings,
  updateStation,
  updateConnection,
  setSelectedId,
  setSelectedConnId
}: PropertiesPanelProps) {
  const getSplitSum = (stationId: string) => {
    return connections
      .filter(c => c.sourceId === stationId && !c.isRework)
      .reduce((sum, c) => sum + c.splitPercent, 0);
  };

  return (
    <aside className="w-80 bg-white border-l border-slate-200 flex flex-col z-20 shadow-xl">
      <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-blue-600" />
          <h2 className="font-bold text-slate-800 tracking-tight">Properties</h2>
        </div>
        {(selectedId || selectedConnId) && (
          <button 
            onClick={() => { setSelectedId(null); setSelectedConnId(null); }}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {selectedId ? (
            <motion.div 
              key="station-props"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {(() => {
                const s = stations.find(st => st.id === selectedId);
                if (!s) return null;
                const isInventory = s.type === 'inventory';
                
                return (
                  <>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-1">
                        {isInventory ? <Box size={14} className="text-blue-600" /> : <Zap size={14} className="text-blue-600" />}
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {(() => {
                            const isStart = !connections.some(c => c.targetId === s.id && !c.isRework);
                            const isFinish = !connections.some(c => c.sourceId === s.id && !c.isRework);
                            let label = isInventory ? 'Inventory Box' : 'Station';
                            if (isStart) label = `Start ${label}`;
                            else if (isFinish) label = `Finish ${label}`;
                            return label;
                          })()} Selected
                        </h3>
                      </div>
                      <input 
                        type="text" 
                        value={s.name}
                        onChange={e => updateStation(selectedId, { name: e.target.value })}
                        className="w-full bg-transparent text-slate-700 font-bold text-lg outline-none focus:text-blue-600 transition-colors"
                      />
                    </div>

                    {!isInventory ? (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flow Mode</label>
                              <InfoTooltip content="Additive: Sums all incoming flows. Assembly: Takes the max of incoming flows (synchronized assembly)." position="bottom" />
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                              <button 
                                onClick={() => updateStation(selectedId, { flowMode: 'additive' })}
                                className={cn(
                                  "px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all",
                                  (!s.flowMode || s.flowMode === 'additive') ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                Additive
                              </button>
                              <button 
                                onClick={() => updateStation(selectedId, { flowMode: 'assembly' })}
                                className={cn(
                                  "px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all",
                                  s.flowMode === 'assembly' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                Assembly
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Auto-Balance Workers</label>
                              <InfoTooltip content="Automatically adjust workers to meet the Takt time based on this station's flow volume." position="bottom" />
                            </div>
                            <button 
                              disabled={settings.autoBalanceAll}
                              onClick={() => updateStation(selectedId, { isAutoBalanced: !s.isAutoBalanced })}
                              className={cn(
                                "w-12 h-6 rounded-full transition-all relative",
                                (s.isAutoBalanced || settings.autoBalanceAll) ? "bg-blue-600" : "bg-slate-200",
                                settings.autoBalanceAll && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className={cn(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                (s.isAutoBalanced || settings.autoBalanceAll) ? "left-7" : "left-1"
                              )} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cycle Time (min)</label>
                          <input 
                            type="number" 
                            value={s.cycleTime}
                            onChange={e => updateStation(selectedId, { cycleTime: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">C/O (min)</label>
                            <input 
                              type="number" 
                              value={s.changeoverTime || 0}
                              onChange={e => updateStation(selectedId, { changeoverTime: Number(e.target.value) })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Uptime (%)</label>
                            <input 
                              type="number" 
                              value={s.uptime || 100}
                              onChange={e => updateStation(selectedId, { uptime: Number(e.target.value) })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quality (%)</label>
                            <input 
                              type="number" 
                              value={s.qualityRate || 100}
                              onChange={e => updateStation(selectedId, { qualityRate: Number(e.target.value) })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batch Size</label>
                            <input 
                              type="number" 
                              value={s.batchSize || 1}
                              onChange={e => updateStation(selectedId, { batchSize: Number(e.target.value) })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Workers</label>
                            <InfoTooltip content="Number of people working in parallel at this station. More workers reduce the effective cycle time." />
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              disabled={s.isAutoBalanced || settings.autoBalanceAll || settings.useConstrainedBalance}
                              onClick={() => updateStation(selectedId, { workers: Math.max(1, s.workers - 1) })}
                              className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-slate-600 transition-colors"
                            >
                              -
                            </button>
                            <div className={cn(
                              "flex-1 text-center font-bold text-lg bg-slate-50 py-1.5 rounded-lg border border-slate-200",
                              (s.isAutoBalanced || settings.autoBalanceAll || settings.useConstrainedBalance) && "text-blue-600 border-blue-100 bg-blue-50"
                            )}>
                              {(s.isAutoBalanced || settings.autoBalanceAll || settings.useConstrainedBalance)
                                ? (metrics.finalWorkers?.[selectedId] || 0)
                                : s.workers}
                            </div>
                            <button 
                              disabled={s.isAutoBalanced || settings.autoBalanceAll || settings.useConstrainedBalance}
                              onClick={() => updateStation(selectedId, { workers: s.workers + 1 })}
                              className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-slate-600 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Max Workers Allowed</label>
                            <InfoTooltip content="Physical limit of how many people can work at this station simultaneously (e.g., due to space or equipment)." />
                          </div>
                          <input 
                            type="number" 
                            value={s.maxWorkersAllowed || ''}
                            placeholder="No limit"
                            onChange={e => updateStation(selectedId, { maxWorkersAllowed: Number(e.target.value) || undefined })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Effective CT</span>
                              <InfoTooltip content="The time it takes for one unit to pass through this station given the number of parallel workers (Cycle Time / Workers)." />
                            </div>
                            <span className="text-sm font-mono font-bold text-slate-700">
                              {(() => {
                                const workers = (s.isAutoBalanced || settings.autoBalanceAll || settings.useConstrainedBalance)
                                  ? (metrics.finalWorkers?.[selectedId] || 1)
                                  : s.workers;
                                return (s.cycleTime / workers).toFixed(2);
                              })()}m
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capacity (units)</label>
                          <input 
                            type="number" 
                            value={s.capacity}
                            onChange={e => updateStation(selectedId, { capacity: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Inventory (units)</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              disabled={settings.autoBalanceAll}
                              value={settings.autoBalanceAll ? (metrics.idealInventories?.[selectedId] || 0) : s.targetInventory}
                              onChange={e => updateStation(selectedId, { targetInventory: Number(e.target.value) })}
                              className={cn(
                                "flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all",
                                settings.autoBalanceAll && "text-blue-600 bg-blue-50 border-blue-100",
                                !settings.autoBalanceAll && (s.targetInventory || 0) > (s.capacity || 0) && "border-red-300 bg-red-50 text-red-700"
                              )}
                            />
                            {settings.autoBalanceAll && (
                              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Ideal</div>
                            )}
                          </div>
                          {!settings.autoBalanceAll && (s.targetInventory || 0) > (s.capacity || 0) && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 mt-1">
                              <AlertCircle size={10} />
                              <span>Target exceeds capacity!</span>
                            </div>
                          )}
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buffer Lead Time</span>
                              <InfoTooltip content="The average time a unit spends in this buffer based on the current flow rate and system takt." />
                            </div>
                            <span className="text-sm font-mono font-bold text-slate-700">
                              {(() => {
                                const flowFactor = metrics.flowFactors?.[selectedId] || 0;
                                const inventory = settings.autoBalanceAll ? (metrics.idealInventories?.[selectedId] || 0) : (s.targetInventory || 0);
                                
                                const maxStationLoad = stations.reduce((max, st) => {
                                  if (st.type === 'inventory') return max;
                                  const ff = metrics.flowFactors?.[st.id] || 0;
                                  const workers = (st.isAutoBalanced || settings.autoBalanceAll || settings.useConstrainedBalance)
                                    ? (metrics.finalWorkers?.[st.id] || 1)
                                    : st.workers;
                                  const load = (st.cycleTime / workers) * ff;
                                  return Math.max(max, load);
                                }, 0);
                                const systemTaktActual = Math.max(metrics.adjustedTakt, maxStationLoad);
                                return flowFactor > 0 ? (inventory * systemTaktActual / flowFactor).toFixed(1) : '0.0';
                              })()}m
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {getSplitSum(selectedId) !== 100 && connections.some(c => c.sourceId === selectedId && !c.isRework) && (
                      <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex gap-3">
                        <AlertCircle className="text-red-500 shrink-0" size={18} />
                        <p className="text-xs text-red-700 leading-relaxed">
                          Outgoing split percentages sum to <span className="font-bold">{getSplitSum(selectedId)}%</span>. They should sum to 100%.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          ) : selectedConnId ? (
            <motion.div 
              key="conn-props"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {(() => {
                const conn = connections.find(c => c.id === selectedConnId)!;
                const source = stations.find(s => s.id === conn.sourceId);
                const target = stations.find(s => s.id === conn.targetId);

                return (
                  <>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Connection Selected</h3>
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <span>{source?.name}</span>
                        <ArrowRight size={14} className="text-slate-400" />
                        <span>{target?.name}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rework Loop</label>
                          <InfoTooltip content="If enabled, this connection represents a quality failure path where units are sent back to an earlier stage." />
                        </div>
                        <button 
                          onClick={() => updateConnection(selectedConnId, { isRework: !conn.isRework })}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            conn.isRework ? "bg-red-500" : "bg-slate-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            conn.isRework ? "left-7" : "left-1"
                          )} />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Split %</label>
                          <InfoTooltip content="The percentage of production volume that follows this path when leaving the station." />
                        </div>
                        <div className="flex items-center gap-3">
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={conn.splitPercent || 0}
                            onChange={e => updateConnection(selectedConnId, { splitPercent: Number(e.target.value) })}
                            className="flex-1 accent-blue-600"
                          />
                          <span className="text-sm font-mono font-bold w-10 text-right">
                            {conn.splitPercent}%
                          </span>
                        </div>
                      </div>

                      {conn.waypoints && conn.waypoints.length > 0 && (
                        <div className="pt-2">
                          <button 
                            onClick={() => updateConnection(selectedConnId, { waypoints: [] })}
                            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <RefreshCw size={14} />
                            Reset Connection Path
                          </button>
                        </div>
                      )}

                      {conn.isRework && (
                        <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 space-y-3">
                          <div className="flex items-center gap-2 text-red-800 font-bold text-[10px] uppercase tracking-wider">
                            <RefreshCw size={14} />
                            <span>Rework Impact Analysis</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[9px] font-bold text-red-400 uppercase">Additional Flow</p>
                              <p className="text-lg font-mono font-bold text-red-700">
                                +{( (metrics.flowFactors?.[conn.sourceId] || 0) * (conn.splitPercent / 100) ).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-red-400 uppercase">Target Load</p>
                              <p className="text-lg font-mono font-bold text-red-700">
                                {(() => {
                                  if (!target) return '0.0';
                                  const flowFactor = metrics.flowFactors?.[target.id] || 0;
                                  const isAutoBalanced = target.isAutoBalanced || settings.autoBalanceAll;
                                  const workers = isAutoBalanced 
                                    ? Math.max(1, Math.ceil((target.cycleTime * flowFactor) / metrics.adjustedTakt))
                                    : target.workers;
                                  return (target.cycleTime / workers * flowFactor).toFixed(1);
                                })()}m
                              </p>
                            </div>
                          </div>

                          <div className="text-[10px] text-red-600 leading-relaxed bg-white/50 p-2 rounded border border-red-100">
                            This loop forces <span className="font-bold">{conn.splitPercent}%</span> of units from <b>{source?.name}</b> back to <b>{target?.name}</b>, increasing the total workload on all stations within the loop.
                          </div>

                          {(() => {
                            if (!target) return null;
                            const flowFactor = metrics.flowFactors?.[target.id] || 0;
                            const isAutoBalanced = target.isAutoBalanced || settings.autoBalanceAll;
                            const workers = isAutoBalanced 
                              ? Math.max(1, Math.ceil((target.cycleTime * flowFactor) / metrics.adjustedTakt))
                              : target.workers;
                            const load = (target.cycleTime / workers * flowFactor);
                            if (load > metrics.adjustedTakt) {
                              return (
                                <div className="flex items-center gap-1 text-red-700 bg-red-100/50 p-2 rounded text-[10px] font-bold border border-red-200">
                                  <AlertCircle size={12} />
                                  <span>Loop creates a bottleneck! (Load &gt; Takt)</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          ) : (
            <motion.div 
              key="no-selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-400"
            >
              <div className="bg-slate-50 p-6 rounded-full">
                <Info size={40} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-600">No Selection</p>
                <p className="text-xs max-w-[200px]">Select a station or connection to view and edit its properties.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
