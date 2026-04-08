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
                    
                    {isInventory && (
                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                          <Box size={16} className="text-blue-600" />
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kanban Source</label>
                        </div>
                        <button 
                          onClick={() => updateStation(selectedId, { isKanbanSource: !s.isKanbanSource })}
                          className={cn(
                            "w-10 h-5 rounded-full transition-all relative",
                            s.isKanbanSource ? "bg-blue-600" : "bg-slate-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                            s.isKanbanSource ? "left-5.5" : "left-0.5"
                          )} />
                        </button>
                      </div>
                    )}

                    {s.type === 'machine' ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cycle Time (min)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={s.cycleTime || ''}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                updateStation(selectedId, { cycleTime: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Input Buffer</label>
                              <InfoTooltip content="Maximum number of units this station can hold in its queue before blocking upstream." />
                            </div>
                            <input 
                              type="number" 
                              step="any"
                              value={s.capacity || ''}
                              placeholder="10"
                              onChange={e => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                updateStation(selectedId, { capacity: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batch Size</label>
                          <input 
                            type="number" 
                            step="any"
                            value={s.batchSize || ''}
                            onChange={e => {
                              const val = e.target.value === '' ? 1 : Number(e.target.value);
                              updateStation(selectedId, { batchSize: val });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">C/O (min)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={s.changeoverTime || ''}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                updateStation(selectedId, { changeoverTime: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">MTBF (min)</label>
                              <input 
                                type="number" 
                                step="any"
                                value={s.mtbf ?? ''}
                                onChange={e => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  updateStation(selectedId, { mtbf: val });
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">MTTR (min)</label>
                              <input 
                                type="number" 
                                step="any"
                                value={s.mttr ?? ''}
                                onChange={e => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  updateStation(selectedId, { mttr: val });
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Effective CT</span>
                              <InfoTooltip content="Cycle Time divided by Batch Size." />
                            </div>
                            <span className="text-sm font-mono font-bold text-slate-700">
                              {(s.cycleTime / (s.batchSize || 1)).toFixed(2)}m
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : !isInventory ? (
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

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cycle Time (min)</label>
                              <InfoTooltip content="Time required to complete one unit of work at this station." />
                            </div>
                            <input 
                              type="number" 
                              step="any"
                              value={s.cycleTime || ''}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                updateStation(selectedId, { cycleTime: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Input Buffer</label>
                              <InfoTooltip content="Maximum number of units this station can hold in its queue before blocking upstream." />
                            </div>
                            <input 
                              type="number" 
                              step="any"
                              value={s.capacity || ''}
                              placeholder="10"
                              onChange={e => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                updateStation(selectedId, { capacity: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">C/O (min)</label>
                              <InfoTooltip content="Changeover Time: Time required to switch between different product types." />
                            </div>
                            <input 
                              type="number" 
                              step="any"
                              value={s.changeoverTime || ''}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                updateStation(selectedId, { changeoverTime: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">MTBF (min)</label>
                                <InfoTooltip content="Mean Time Between Failures: Average time between station breakdowns." />
                              </div>
                              <input 
                                type="number" 
                                step="any"
                                value={s.mtbf ?? ''}
                                onChange={e => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  updateStation(selectedId, { mtbf: val });
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">MTTR (min)</label>
                                <InfoTooltip content="Mean Time To Repair: Average time to fix a station breakdown." />
                              </div>
                              <input 
                                type="number" 
                                step="any"
                                value={s.mttr ?? ''}
                                onChange={e => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  updateStation(selectedId, { mttr: val });
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quality (%)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={s.qualityRate ?? 100}
                              onChange={e => {
                                const val = e.target.value === '' ? 100 : Number(e.target.value);
                                updateStation(selectedId, { qualityRate: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batch Size</label>
                            <input 
                              type="number" 
                              step="any"
                              value={s.batchSize || ''}
                              onChange={e => {
                                const val = e.target.value === '' ? 1 : Number(e.target.value);
                                updateStation(selectedId, { batchSize: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">FTE</label>
                            <InfoTooltip content="Full-Time Equivalent (FTE) for this station. More FTE reduces the effective cycle time." />
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => updateStation(selectedId, { fte: Math.max(0.1, s.fte - 0.1) })}
                              className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-slate-600 transition-colors"
                            >
                              -
                            </button>
                            <div className="flex-1 text-center font-bold text-lg bg-slate-50 py-1.5 rounded-lg border border-slate-200">
                              {s.fte.toFixed(1)}
                            </div>
                            <button 
                              onClick={() => updateStation(selectedId, { fte: s.fte + 0.1 })}
                              className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-slate-600 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Max FTE Allowed</label>
                            <InfoTooltip content="Physical limit of how much FTE can work at this station simultaneously (e.g., due to space or equipment)." />
                          </div>
                          <input 
                            type="number" 
                            value={s.maxFteAllowed || ''}
                            placeholder="No limit"
                            onChange={e => updateStation(selectedId, { maxFteAllowed: Number(e.target.value) || undefined })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Min FTE</label>
                              <InfoTooltip content="Minimum FTE required to operate this station safely or effectively." />
                            </div>
                            <input 
                              type="number" 
                              value={s.minFteRequired || ''}
                              placeholder="1"
                              onChange={e => updateStation(selectedId, { minFteRequired: Number(e.target.value) || undefined })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trained FTE</label>
                              <InfoTooltip content="Maximum number of trained FTE available for this specific station." />
                            </div>
                            <input 
                              type="number" 
                              value={s.trainedFteAvailable || ''}
                              placeholder="No limit"
                              onChange={e => updateStation(selectedId, { trainedFteAvailable: Number(e.target.value) || undefined })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Effective CT</span>
                              <InfoTooltip content="The time it takes for one unit to pass through this station given the number of parallel FTE (Cycle Time / FTE)." />
                            </div>
                            <span className="text-sm font-mono font-bold text-slate-700">
                              {(() => {
                                const fte = s.fte;
                                return (s.cycleTime / fte).toFixed(2);
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
                            step="any"
                            value={s.capacity || ''}
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value);
                              updateStation(selectedId, { capacity: val });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Inventory (units)</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              step="any"
                              value={s.targetInventory || ''}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                updateStation(selectedId, { targetInventory: val });
                              }}
                              className={cn(
                                "flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all",
                                (s.targetInventory || 0) > (s.capacity || 0) && "border-red-300 bg-red-50 text-red-700"
                              )}
                            />
                          </div>
                          {(s.targetInventory || 0) > (s.capacity || 0) && (
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
                                const inventory = s.targetInventory || 0;
                                
                                const maxStationLoad = stations.reduce((max, st) => {
                                  if (st.type === 'inventory') return max;
                                  const ff = metrics.flowFactors?.[st.id] || 0;
                                  const fte = st.fte;
                                  const load = (st.cycleTime / fte) * ff;
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

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Input Group (Optional)</label>
                          <InfoTooltip content="For assembly stations, connections with the same group act as alternatives (OR logic)." />
                        </div>
                        <input 
                          type="text" 
                          placeholder="e.g., Engine"
                          value={conn.inputGroup || ''}
                          onChange={e => updateConnection(selectedConnId, { inputGroup: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
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
                                  const fte = target.fte;
                                  return (target.cycleTime / fte * flowFactor).toFixed(1);
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
                            const fte = target.fte;
                            const load = (target.cycleTime / fte * flowFactor);
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
