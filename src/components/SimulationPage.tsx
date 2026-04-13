import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AssemblyLine, GlobalSettings, SimulationResult, Station, Connection } from '../types';
import { runSimulation } from '../utils/simulator';
import { parseTime, getAvailableMinutes } from '../utils/timeUtils';
import { Activity } from 'lucide-react';
import { ScheduleConfig } from './ScheduleConfig';
import { SimulationHeader } from './simulation/SimulationHeader';
import { SimulationSidebar } from './simulation/SimulationSidebar';
import { SimulationPlayback } from './simulation/SimulationPlayback';
import { SimulationKPIs } from './simulation/SimulationKPIs';
import { SimulationCharts } from './simulation/SimulationCharts';
import { BottleneckAnalysis as BottleneckAnalysisComp } from './simulation/BottleneckAnalysis';
import { MonteCarloResults } from './simulation/MonteCarloResults';
import { ShiftPerformance } from './simulation/ShiftPerformance';
import { AIInsights } from './simulation/AIInsights';

interface SimulationPageProps {
  lines: AssemblyLine[];
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  onBack: () => void;
}

export function SimulationPage({ lines: initialLines, settings, setSettings, onBack }: SimulationPageProps) {
  const [localLines, setLocalLines] = useState<AssemblyLine[]>(initialLines);
  const [selectedLineId, setSelectedLineId] = useState<string>(initialLines[0]?.id || '');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  
  useEffect(() => {
    if (!selectedLineId && initialLines.length > 0) {
      setSelectedLineId(initialLines[0].id);
    }
  }, [initialLines, selectedLineId]);

  const [durationHours, setDurationHours] = useState<number>(24);
  const [stepMinutes, setStepMinutes] = useState<number>(1);
  const [variability, setVariability] = useState<number>(10);
  const [enableRework, setEnableRework] = useState<boolean>(true);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<{ mean: number, min: number, max: number, p5: number, p95: number, outputs: number[] } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(1440);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const selectedLine = useMemo(() => localLines.find(l => l.id === selectedLineId), [localLines, selectedLineId]);

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
    
    const firstShift = settings.schedule?.days[0]?.shifts[0];
    const start = firstShift ? parseTime(firstShift.startTime) : 0;
    const end = start + (durationHours * 60);
    
    setStartTime(start);
    setEndTime(end);
    setCurrentTime(start);
    
    const timer = setTimeout(() => {
      try {
        const simResult = runSimulation(selectedLine, settings, durationHours * 60, stepMinutes, variability, enableRework, start, end);
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
      const firstShift = settings.schedule?.days[0]?.shifts[0];
      const start = firstShift ? parseTime(firstShift.startTime) : 0;
      const end = start + (durationHours * 60);
      for (let i = 0; i < 100; i++) {
        const simResult = runSimulation(selectedLine, settings, durationHours * 60, stepMinutes, variability, enableRework, start, end);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      handleRunSimulation();
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedLine?.stations, selectedLine?.connections, variability, durationHours, stepMinutes, enableRework, settings, selectedLineId]);

  useEffect(() => {
    if (isPlaying && result) {
      playbackIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + (stepMinutes * playbackSpeed);
          if (next >= endTime) {
            setIsPlaying(false);
            return endTime;
          }
          return next;
        });
      }, 500 / playbackSpeed);
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }
    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    };
  }, [isPlaying, result, endTime, playbackSpeed, stepMinutes]);

  const currentSnapshot = useMemo(() => {
    if (!result) return null;
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
    const taktTime = getAvailableMinutes(settings) / (settings.demand || 1);
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
        return { id: s.id, name: s.name, utilization, starvation, blockage, reason, severity };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }, [result, selectedLine, settings]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {isScheduleOpen && (
        <ScheduleConfig 
          schedule={settings.schedule || { days: Array(7).fill({ shifts: [] }) }}
          setSchedule={(s) => setSettings({ ...settings, schedule: s })}
          onClose={() => setIsScheduleOpen(false)}
        />
      )}

      <SimulationHeader 
        onBack={onBack} 
        onOpenSchedule={() => setIsScheduleOpen(true)} 
        durationHours={durationHours}
      />

      <div className="flex-1 flex overflow-hidden">
        <SimulationSidebar 
          selectedLineId={selectedLineId}
          setSelectedLineId={setSelectedLineId}
          localLines={localLines}
          isSimulating={isSimulating}
          hasResult={!!result}
          durationHours={durationHours}
          setDurationHours={setDurationHours}
          stepMinutes={stepMinutes}
          setStepMinutes={setStepMinutes}
          variability={variability}
          setVariability={setVariability}
          enableRework={enableRework}
          setEnableRework={setEnableRework}
          onRunMonteCarlo={handleRunMonteCarlo}
        />

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
              {monteCarloResult && <MonteCarloResults monteCarloResult={monteCarloResult} />}
              
              <SimulationPlayback 
                selectedLine={selectedLine}
                currentSnapshot={currentSnapshot}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                startTime={startTime}
                endTime={endTime}
                stepMinutes={stepMinutes}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                playbackSpeed={playbackSpeed}
                setPlaybackSpeed={setPlaybackSpeed}
                stationUtilization={result.stationUtilization}
                updateStation={updateStation}
                updateConnection={updateConnection}
                selectedStationId={selectedStationId}
                setSelectedStationId={setSelectedStationId}
                selectedConnectionId={selectedConnectionId}
                setSelectedConnectionId={setSelectedConnectionId}
              />

              <SimulationKPIs result={result} durationHours={durationHours} snapshot={currentSnapshot} />

              {settings.enableAI && selectedLine && (
                <AIInsights line={selectedLine} settings={settings} result={result} />
              )}

              {result.shiftMetrics && result.shiftMetrics.length > 0 && (
                <ShiftPerformance shiftMetrics={result.shiftMetrics} />
              )}

              <SimulationCharts 
                outputData={outputData}
                utilizationData={utilizationData}
                defectsData={defectsData}
                inventoryData={inventoryData}
                selectedLine={selectedLine}
                stepMinutes={stepMinutes}
              />

              <BottleneckAnalysisComp bottleneckAnalysis={bottleneckAnalysis} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
