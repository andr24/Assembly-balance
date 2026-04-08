import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AssemblyLine, GlobalSettings, SimulationResult, SimulationSnapshot, Station, Connection } from '../types';
import { runSimulation } from '../utils/simulator';
import { ArrowLeft, Play, Clock, BarChart3, TrendingUp, AlertTriangle, Package, Activity, Pause, RotateCcw, FastForward, Trash2, Info, Flame, Zap, ShieldAlert, Gauge } from 'lucide-react';
import { SimulationCanvas } from './SimulationCanvas';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell,
  AreaChart,
  Area
} from 'recharts';

interface SimulationPageProps {
  lines: AssemblyLine[];
  settings: GlobalSettings;
  onBack: () => void;
}

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  key?: React.Key;
  className?: string;
}

function TooltipWrapper({ content, children, className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  return (
    <div 
      className={cn("relative inline-block", className)}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPosition({ x: rect.left + rect.width / 2, y: rect.top });
        setIsVisible(true);
      }}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, x: '-50%' }}
            animate={{ opacity: 1, y: -5, x: '-50%' }}
            exit={{ opacity: 0, y: 5, x: '-50%' }}
            className="fixed z-[100] px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg pointer-events-none whitespace-nowrap"
            style={{ 
              left: position.x,
              top: position.y - 30
            }}
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SimulationPage({ lines: initialLines, settings, onBack }: Omit<SimulationPageProps, 'updateStation'>) {
  const [localLines, setLocalLines] = useState<AssemblyLine[]>(initialLines);
  const [selectedLineId, setSelectedLineId] = useState<string>(initialLines[0]?.id || '');
  
  // Sync selectedLineId if it was empty and lines become available
  useEffect(() => {
    if (!selectedLineId && initialLines.length > 0) {
      setSelectedLineId(initialLines[0].id);
    }
  }, [initialLines, selectedLineId]);

  const [durationHours, setDurationHours] = useState<number>(8);
  const [stepMinutes, setStepMinutes] = useState<number>(1);
  const [variability, setVariability] = useState<number>(10);
  const [enableRework, setEnableRework] = useState<boolean>(true);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<{ mean: number, min: number, max: number, p5: number, p95: number, outputs: number[] } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const selectedLine = useMemo(() => localLines.find(l => l.id === selectedLineId), [localLines, selectedLineId]);
  const selectedStation = useMemo(() => selectedLine?.stations.find(s => s.id === selectedStationId), [selectedLine, selectedStationId]);
  const selectedConnection = useMemo(() => selectedLine?.connections.find(c => c.id === selectedConnectionId), [selectedLine, selectedConnectionId]);

  const updateStation = (id: string, updates: Partial<Station>) => {
    setLocalLines(prev => prev.map(line => {
      if (line.stations.some(s => s.id === id)) {
        return {
          ...line,
          stations: line.stations.map(s => s.id === id ? { ...s, ...updates } : s)
        };
      }
      return line;
    }));
  };

  const updateConnection = (id: string, updates: Partial<Connection>) => {
    setLocalLines(prev => prev.map(line => {
      if (line.connections.some(c => c.id === id)) {
        return {
          ...line,
          connections: line.connections.map(c => c.id === id ? { ...c, ...updates } : c)
        };
      }
      return line;
    }));
  };

  const handleRunSimulation = () => {
    if (!selectedLine || selectedLine.stations.length === 0) {
      setResult(null);
      return;
    }
    
    setIsSimulating(true);
    setIsPlaying(false);
    setCurrentTime(0);
    
    // Run simulation
    // We use a small delay to ensure UI updates first
    const timer = setTimeout(() => {
      try {
        const simResult = runSimulation(selectedLine, settings, durationHours * 60, stepMinutes, variability, enableRework);
        setResult(simResult);
      } catch (error) {
        console.error("Simulation failed:", error);
        setResult(null);
      } finally {
        setIsSimulating(false);
      }
    }, 50);
    
    return () => clearTimeout(timer);
  };

  const handleRunMonteCarlo = () => {
    if (!selectedLine || selectedLine.stations.length === 0) {
      setMonteCarloResult(null);
      return;
    }
    
    setIsSimulating(true);
    setMonteCarloResult(null);
    
    setTimeout(() => {
      const outputs: number[] = [];
      for (let i = 0; i < 100; i++) {
        const simResult = runSimulation(selectedLine, settings, durationHours * 60, stepMinutes, variability, enableRework);
        outputs.push(simResult.totalOutput);
      }
      
      outputs.sort((a, b) => a - b);
      const mean = outputs.reduce((a, b) => a + b, 0) / outputs.length;
      setMonteCarloResult({
        mean,
        min: outputs[0],
        max: outputs[outputs.length - 1],
        p5: outputs[Math.floor(outputs.length * 0.05)],
        p95: outputs[Math.floor(outputs.length * 0.95)],
        outputs
      });
      setIsSimulating(false);
    }, 50);
  };

  // Auto-run simulation when constraints change
  // We use a debounce to prevent excessive runs during typing
  useEffect(() => {
    const timer = setTimeout(() => {
      handleRunSimulation();
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [selectedLine?.stations, selectedLine?.connections, variability, durationHours, stepMinutes, enableRework, settings, selectedLineId]);

  useEffect(() => {
    if (isPlaying && result) {
      playbackIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + (stepMinutes * playbackSpeed);
          if (next >= durationHours * 60) {
            setIsPlaying(false);
            return durationHours * 60;
          }
          return next;
        });
      }, 500 / playbackSpeed); // Adjust interval for smoother playback feel at different speeds
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }
    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    };
  }, [isPlaying, result, durationHours, playbackSpeed, stepMinutes]);

  const currentSnapshot = useMemo(() => {
    if (!result) return null;
    // Find the closest snapshot to currentTime
    return result.snapshots.find(s => s.time === currentTime) || 
           result.snapshots.reduce((prev, curr) => Math.abs(curr.time - currentTime) < Math.abs(prev.time - currentTime) ? curr : prev);
  }, [result, currentTime]);

  const utilizationData = useMemo(() => {
    if (!result || !selectedLine) return [];
    return selectedLine.stations
      .filter(s => s.type !== 'inventory')
      .map(s => ({
        name: s.name,
        utilization: Number(result.stationUtilization[s.id]?.toFixed(1) || 0),
        starvation: Number(result.starvationTime[s.id]?.toFixed(1) || 0),
        blockage: Number(result.blockageTime[s.id]?.toFixed(1) || 0)
      }));
  }, [result, selectedLine]);

  const inventoryData = useMemo(() => {
    if (!result || !selectedLine) return [];
    return result.snapshots.map(snap => {
      const data: any = { time: `${snap.time}m` };
      selectedLine.stations.forEach(s => {
        data[s.name] = Number(snap.inventory[s.id]?.toFixed(1) || 0);
      });
      return data;
    });
  }, [result, selectedLine]);

  const outputData = useMemo(() => {
    if (!result) return [];
    return result.snapshots.map((snap, i) => {
      const prevOutput = i > 0 ? result.snapshots[i-1].output : 0;
      const prevDefects = i > 0 ? result.snapshots[i-1].defects : 0;
      const prevRework = i > 0 ? result.snapshots[i-1].rework : 0;
      return {
        time: `${snap.time}m`,
        total: snap.output,
        incremental: snap.output - prevOutput,
        defects: snap.defects - prevDefects,
        rework: snap.rework - prevRework
      };
    });
  }, [result]);

  const defectsData = useMemo(() => {
    if (!result || !selectedLine) return [];
    return selectedLine.stations
      .filter(s => s.type !== 'inventory')
      .map(s => ({
        name: s.name,
        defects: result.defectsByStation[s.id] || 0,
        rework: result.reworkByStation[s.id] || 0
      }));
  }, [result, selectedLine]);

  const bottleneckAnalysis = useMemo(() => {
    if (!result || !selectedLine) return [];
    
    const taktTime = (settings.availableHours * 60) / (settings.demand || 1);

    return selectedLine.stations
      .filter(s => s.type !== 'inventory')
      .map(s => {
        const utilization = result.stationUtilization[s.id] || 0;
        const starvation = result.starvationTime[s.id] || 0;
        const blockage = result.blockageTime[s.id] || 0;
        const cycleTime = s.cycleTime || 0;
        
        let reason = "";
        let severity: 'high' | 'medium' | 'low' = 'low';
        
        if (cycleTime > taktTime) {
          reason = `Takt Violation: Cycle time (${cycleTime.toFixed(1)}m) exceeds Takt time (${taktTime.toFixed(1)}m).`;
          severity = 'high';
        } else if (utilization > 90) {
          reason = "Maximum Utilization: Station is working constantly with no recovery time.";
          severity = 'high';
        } else if (utilization > 75) {
          reason = "High Load: Approaching capacity limits. Vulnerable to variability.";
          severity = 'medium';
        } else if (blockage > 30) {
          reason = "Downstream Blockage: Forced to stop because the next station is too slow.";
          severity = 'medium';
        } else if (starvation > 30) {
          reason = "Upstream Starvation: Waiting for parts from previous stages.";
          severity = 'medium';
        } else {
          reason = "Stable: Balanced workload with sufficient buffer capacity.";
          severity = 'low';
        }
        
        return {
          id: s.id,
          name: s.name,
          utilization,
          starvation,
          blockage,
          reason,
          severity
        };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }, [result, selectedLine, settings]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Production Simulator</h1>
            <p className="text-sm text-slate-500">Dynamic digital twin of your assembly line</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Configuration */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
          <div className="p-6 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Simulation Setup</h2>
                {isSimulating && result && (
                  <div className="flex items-center gap-1.5 text-blue-600 animate-pulse">
                    <div className="w-2 h-2 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Calculating...</span>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Select Line</label>
                  <select 
                    value={selectedLineId}
                    onChange={e => setSelectedLineId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {localLines.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <TooltipWrapper content="Total time to run the simulation for">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Clock size={16} className="text-blue-500" />
                      Duration (Hours)
                    </label>
                  </TooltipWrapper>
                  <input 
                    type="number" 
                    min="1"
                    value={durationHours}
                    onChange={e => setDurationHours(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <TooltipWrapper content="Frequency of data collection snapshots">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Activity size={16} className="text-purple-500" />
                      Snapshot Interval (Min)
                    </label>
                  </TooltipWrapper>
                  <input 
                    type="number" 
                    min="1"
                    value={stepMinutes}
                    onChange={e => setStepMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <TooltipWrapper content="Random variation added to cycle times">
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <AlertTriangle size={16} className="text-amber-500" />
                        Variability
                      </label>
                    </TooltipWrapper>
                    <span className="text-xs font-mono font-bold text-amber-600">{variability}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="50" 
                    step="5"
                    value={variability}
                    onChange={e => setVariability(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 italic">Simulates random fluctuations in cycle times.</p>
                </div>

                <TooltipWrapper content="Run 100 simulation iterations to assess performance variability and risk">
                  <button
                    onClick={handleRunMonteCarlo}
                    disabled={isSimulating}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-purple-200 mt-4"
                  >
                    <Zap size={18} />
                    Run Monte Carlo (100x)
                  </button>
                </TooltipWrapper>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-slate-700">Enable Rework</label>
                    <TooltipWrapper content="If enabled, defective units will be sent back to the previous station. If no rework loop exists, cycle time increases to fix the unit.">
                      <Info size={14} className="text-slate-400" />
                    </TooltipWrapper>
                  </div>
                  <button
                    onClick={() => setEnableRework(!enableRework)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      enableRework ? "bg-blue-600" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                      enableRework ? "left-6" : "left-1"
                    )} />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Main Content - Results */}
        <div className="flex-1 p-8 overflow-y-auto">
          {isSimulating && !result ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
              <p className="text-lg font-medium text-slate-500">Calculating simulation results...</p>
            </div>
          ) : !result ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                <Activity size={32} strokeWidth={1.5} />
              </div>
              <p className="text-lg font-medium text-slate-500">Run a simulation to see dynamic performance data.</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-8 pb-20">
              {/* Monte Carlo Results */}
              {monteCarloResult && (
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
                      <BarChart data={monteCarloResult.outputs.map((o, i) => ({ output: o }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="output" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="output" fill="#a855f7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Activity size={18} className="text-blue-500" />
                    Visual Simulation Playback
                  </h3>
                  <div className="flex items-center gap-4">
                    {/* State Legend */}
                    <div className="flex items-center gap-4 mr-4 border-r border-slate-200 pr-4">
                      <TooltipWrapper content="Station is actively processing a unit">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Working</span>
                        </div>
                      </TooltipWrapper>
                      <TooltipWrapper content="Station is idle, waiting for input from upstream">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Starved</span>
                        </div>
                      </TooltipWrapper>
                      <TooltipWrapper content="Station is finished but downstream buffer is full">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Blocked</span>
                        </div>
                      </TooltipWrapper>
                      <TooltipWrapper content="Station is non-operational due to a breakdown (Uptime constraint)">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Down</span>
                        </div>
                      </TooltipWrapper>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
                      <Clock size={14} className="text-slate-500" />
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {Math.floor(currentTime / 60)}h {currentTime % 60}m
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[450px] relative">
                  <SimulationCanvas 
                    stations={selectedLine?.stations || []} 
                    connections={selectedLine?.connections || []} 
                    snapshot={currentSnapshot} 
                    stationUtilization={result.stationUtilization}
                    onStationMove={(id, x, y) => updateStation(id, { x, y })}
                    onStationClick={(id) => {
                      setSelectedStationId(id);
                      setSelectedConnectionId(null);
                    }}
                    onConnectionClick={(id) => {
                      setSelectedConnectionId(id);
                      setSelectedStationId(null);
                    }}
                    selectedStationId={selectedStationId}
                    selectedConnectionId={selectedConnectionId}
                  />

                  {/* Station Edit Panel Overlay */}
                  <AnimatePresence>
                    {selectedStation && (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="absolute top-4 left-4 w-64 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-4 z-30"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-slate-800 text-sm truncate">{selectedStation.name}</h4>
                          <button 
                            onClick={() => setSelectedStationId(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <ArrowLeft size={16} />
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cycle Time (min)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={selectedStation.cycleTime || ''}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                updateStation(selectedStation.id, { cycleTime: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          {selectedStation.type !== 'inventory' && (
                            <>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">FTE</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  value={selectedStation.fte || ''}
                                  onChange={e => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    updateStation(selectedStation.id, { fte: val });
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quality Rate (%)</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  value={selectedStation.qualityRate ?? 100}
                                  onChange={e => {
                                    const val = e.target.value === '' ? 100 : Number(e.target.value);
                                    updateStation(selectedStation.id, { qualityRate: val });
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                            </>
                          )}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Inv (u)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={selectedStation.targetInventory || ''}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                updateStation(selectedStation.id, { targetInventory: val });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-4 italic">Simulation will auto-update on change.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Connection Edit Panel Overlay */}
                  <AnimatePresence>
                    {selectedConnection && (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="absolute top-4 left-4 w-64 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-4 z-30"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-slate-800 text-sm truncate">Connection Split</h4>
                          <button 
                            onClick={() => setSelectedConnectionId(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <ArrowLeft size={16} />
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Split Percent (%)</label>
                            <div className="flex items-center gap-3">
                              <input 
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={selectedConnection.splitPercent || 0}
                                onChange={e => updateConnection(selectedConnection.id, { splitPercent: Number(e.target.value) })}
                                className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                              <input 
                                type="number" 
                                min="0"
                                max="100"
                                value={selectedConnection.splitPercent || 0}
                                onChange={e => updateConnection(selectedConnection.id, { splitPercent: Math.min(100, Math.max(0, Number(e.target.value))) })}
                                className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-[10px] text-blue-700 leading-relaxed">
                              Adjust the percentage of units that will flow through this connection.
                            </p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Input Group (Optional)</label>
                            <input 
                              type="text" 
                              placeholder="e.g., Engine"
                              value={selectedConnection.inputGroup || ''}
                              onChange={e => updateConnection(selectedConnection.id, { inputGroup: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-[9px] text-slate-400 mt-1">For assembly stations, connections with the same group act as alternatives (OR logic).</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-4 italic">Simulation will auto-update on change.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
                    <TooltipWrapper content="Reset playback to start">
                      <button 
                        onClick={() => {
                          setCurrentTime(0);
                          setIsPlaying(false);
                        }}
                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                      >
                        <RotateCcw size={20} />
                      </button>
                    </TooltipWrapper>
                    <TooltipWrapper content={isPlaying ? "Pause playback" : "Start playback"}>
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                      </button>
                    </TooltipWrapper>
                  </div>

                  <div className="flex-1 flex items-center gap-4 px-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono">0m</span>
                    <TooltipWrapper content="Drag to scrub through time" className="flex-1 block">
                      <input 
                        type="range" 
                        min="0" 
                        max={durationHours * 60} 
                        step={stepMinutes}
                        value={currentTime}
                        onChange={e => {
                          setCurrentTime(Number(e.target.value));
                          setIsPlaying(false);
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </TooltipWrapper>
                    <span className="text-[10px] font-bold text-slate-400 font-mono whitespace-nowrap">{durationHours * 60}m</span>
                  </div>

                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 ml-auto">
                    {[1, 5, 10, 30].map(speed => (
                      <TooltipWrapper key={speed} content={`Set playback speed to ${speed}x`}>
                        <button
                          onClick={() => setPlaybackSpeed(speed)}
                          className={cn(
                            "px-2 py-1 text-[10px] font-bold rounded transition-colors",
                            playbackSpeed === speed ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:bg-slate-50"
                          )}
                        >
                          {speed}x
                        </button>
                      </TooltipWrapper>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
                <TooltipWrapper content="Total units produced by the line">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Output</div>
                    <div className="text-2xl font-mono font-bold text-slate-800">{result.totalOutput} <span className="text-xs text-slate-400 font-sans">u</span></div>
                  </div>
                </TooltipWrapper>
                <TooltipWrapper content="Average units produced per hour">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Throughput</div>
                    <div className="text-2xl font-mono font-bold text-blue-600">{(result.totalOutput / durationHours).toFixed(1)} <span className="text-xs text-slate-400 font-sans">u/h</span></div>
                  </div>
                </TooltipWrapper>
                <TooltipWrapper content="Total units that failed quality check (either reworked or repaired on-the-spot)">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Defects</div>
                    <div className="text-2xl font-mono font-bold text-red-600">{result.totalDefects} <span className="text-xs text-slate-400 font-sans">u</span></div>
                  </div>
                </TooltipWrapper>
                <TooltipWrapper content="Total units that failed quality check but were sent back for rework to a previous station">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Rework</div>
                    <div className="text-2xl font-mono font-bold text-amber-600">{result.totalRework} <span className="text-xs text-slate-400 font-sans">u</span></div>
                  </div>
                </TooltipWrapper>
                <TooltipWrapper content="Percentage of total units that were defective">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Defect Rate</div>
                    <div className="text-2xl font-mono font-bold text-amber-600">
                      {(((result.totalDefects + result.totalRework) / (result.totalOutput + result.totalDefects + result.totalRework || 1)) * 100).toFixed(1)}%
                    </div>
                  </div>
                </TooltipWrapper>
                <TooltipWrapper content="Work In Progress: Total units currently in the line">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Final WIP</div>
                    <div className="text-2xl font-mono font-bold text-orange-600">{result.snapshots[result.snapshots.length - 1].wip.toFixed(0)} <span className="text-xs text-slate-400 font-sans">u</span></div>
                  </div>
                </TooltipWrapper>
                <TooltipWrapper content="Average time stations were actively working">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Util.</div>
                    <div className="text-2xl font-mono font-bold text-green-600">
                      {((Object.values(result.stationUtilization) as number[]).reduce((a: number, b: number) => a + b, 0) / (Object.keys(result.stationUtilization).length || 1)).toFixed(1)}%
                    </div>
                  </div>
                </TooltipWrapper>
              </div>

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
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
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
              <div className="grid grid-cols-2 gap-8">
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
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend />
                      {selectedLine.stations.map((s, i) => (
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

              {/* Bottleneck Analysis Section */}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
