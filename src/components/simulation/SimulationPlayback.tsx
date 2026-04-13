import React from 'react';
import { Activity, Clock, RotateCcw, Pause, Play, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SimulationCanvas } from '../SimulationCanvas';
import { TooltipWrapper } from './TooltipWrapper';
import { SimulationSnapshot, Station, Connection, AssemblyLine } from '../../types';
import { cn } from '../../lib/utils';

interface SimulationPlaybackProps {
  selectedLine: AssemblyLine | undefined;
  currentSnapshot: SimulationSnapshot | null;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  startTime: number;
  endTime: number;
  stepMinutes: number;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (s: number) => void;
  stationUtilization: Record<string, number>;
  updateStation: (id: string, updates: Partial<Station>) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  selectedStationId: string | null;
  setSelectedStationId: (id: string | null) => void;
  selectedConnectionId: string | null;
  setSelectedConnectionId: (id: string | null) => void;
}

export function SimulationPlayback({
  selectedLine,
  currentSnapshot,
  currentTime,
  setCurrentTime,
  startTime,
  endTime,
  stepMinutes,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  stationUtilization,
  updateStation,
  updateConnection,
  selectedStationId,
  setSelectedStationId,
  selectedConnectionId,
  setSelectedConnectionId
}: SimulationPlaybackProps) {
  const formatMinutes = (m: number) => {
    const day = Math.floor(m / 1440);
    const mins = m % 1440;
    const h = Math.floor(mins / 60);
    const mm = mins % 60;
    return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}${day > 0 ? ` (+${day}d)` : ''}`;
  };
  const selectedStation = selectedLine?.stations.find(s => s.id === selectedStationId);
  const selectedConnection = selectedLine?.connections.find(c => c.id === selectedConnectionId);

  return (
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
              {formatMinutes(currentTime)}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
            <span className="text-xs font-bold">
              {currentSnapshot?.weekday} - {currentSnapshot?.shiftName}
              {currentSnapshot?.shiftStartTime && currentSnapshot?.shiftEndTime && (
                <span className="ml-2 text-[10px] opacity-70 font-mono">
                  ({currentSnapshot.shiftStartTime} - {currentSnapshot.shiftEndTime})
                </span>
              )}
            </span>
          </div>
          {currentSnapshot?.staffingRatio !== undefined && currentSnapshot.staffingRatio !== 1 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100">
              <span className="text-xs font-bold">Staffing: {(currentSnapshot.staffingRatio * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="h-[450px] relative">
        <SimulationCanvas 
          stations={selectedLine?.stations || []} 
          connections={selectedLine?.connections || []} 
          snapshot={currentSnapshot} 
          stationUtilization={stationUtilization}
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
                setCurrentTime(startTime);
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
          <span className="text-[10px] font-bold text-slate-400 font-mono">{formatMinutes(startTime)}</span>
          <TooltipWrapper content="Drag to scrub through time" className="flex-1 block">
            <input 
              type="range" 
              min={startTime} 
              max={endTime} 
              step={stepMinutes}
              value={currentTime}
              onChange={e => {
                setCurrentTime(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </TooltipWrapper>
          <span className="text-[10px] font-bold text-slate-400 font-mono whitespace-nowrap">{formatMinutes(endTime)}</span>
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
  );
}
