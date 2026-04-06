/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAssemblyLine } from './hooks/useAssemblyLine';
import { useMetrics } from './hooks/useMetrics';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { SummaryPanel } from './components/SummaryPanel';
import { AnimatePresence } from 'motion/react';
import { GripHorizontal } from 'lucide-react';

export default function App() {
  const {
    lines,
    activeLineId,
    setActiveLineId,
    settings,
    setSettings,
    stations,
    connections,
    updateStation,
    updateConnection,
    addStation,
    addConnection,
    deleteElement,
    duplicateStation,
    updateActiveLine,
    setLines
  } = useAssemblyLine();

  const metrics = useMetrics(stations, connections, settings);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [summaryHeight, setSummaryHeight] = useState(256);
  const [isResizing, setIsResizing] = useState(false);

  // --- Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newHeight = window.innerHeight - e.clientY;
    setSummaryHeight(Math.min(Math.max(newHeight, 100), window.innerHeight - 200));
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // --- Handlers ---
  const handleAddLine = () => {
    const newLine = {
      id: `line${Date.now()}`,
      name: `Line ${lines.length + 1}`,
      stations: [],
      connections: []
    };
    setLines([...lines, newLine]);
    setActiveLineId(newLine.id);
  };

  const handleRenameLine = (id: string, name: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, name } : l));
  };

  const handleDeleteLine = (id: string) => {
    if (lines.length <= 1) return;
    const newLines = lines.filter(l => l.id !== id);
    setLines(newLines);
    if (activeLineId === id) {
      setActiveLineId(newLines[0].id);
    }
  };

  const handleExportExcel = () => {
    const data = stations.map(s => {
      const flowFactor = metrics.flowFactors?.[s.id] || 0;
      const isAutoBalanced = s.isAutoBalanced || settings.autoBalanceAll;
      const workers = isAutoBalanced 
        ? Math.max(1, Math.ceil((s.cycleTime * flowFactor) / metrics.adjustedTakt))
        : s.workers;
      const effectiveCT = s.cycleTime / workers;
      const load = effectiveCT * flowFactor;
      
      return {
        Station: s.name,
        Type: s.type || 'station',
        'Cycle Time (min)': s.cycleTime,
        Workers: workers,
        'Effective CT (min)': effectiveCT.toFixed(2),
        'Flow Factor': flowFactor.toFixed(2),
        'Load (min)': load.toFixed(2),
        'Capacity (u)': s.capacity || '-',
        'Target Inv (u)': s.targetInventory || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Line Balance");
    XLSX.writeFile(wb, "AssemblyLineBalance.xlsx");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.lines && imported.settings) {
          setLines(imported.lines);
          setSettings(imported.settings);
          setActiveLineId(imported.lines[0].id);
        }
      } catch (err) {
        console.error("Failed to import JSON", err);
      }
    };
    reader.readAsText(file);
  };

  const handleExportJSON = () => {
    const data = JSON.stringify({ lines, settings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "AssemblyLineConfig.json";
    a.click();
  };

  const handleDelete = () => {
    if (selectedId) {
      deleteElement(selectedId, 'station');
      setSelectedId(null);
    } else if (selectedConnId) {
      deleteElement(selectedConnId, 'connection');
      setSelectedConnId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Toolbar 
        lines={lines}
        activeLineId={activeLineId}
        setActiveLineId={setActiveLineId}
        settings={settings}
        setSettings={setSettings}
        onAddLine={handleAddLine}
        onRenameLine={handleRenameLine}
        onDeleteLine={handleDeleteLine}
        onAddStation={addStation}
        onDelete={handleDelete}
        onExport={handleExportJSON}
        onExportExcel={handleExportExcel}
        onImport={handleImportJSON}
        selectedId={selectedId}
        selectedConnId={selectedConnId}
        isConnecting={isConnecting}
        setIsConnecting={setIsConnecting}
      />

      <div className="flex-1 flex overflow-hidden">
        <Canvas 
          stations={stations}
          connections={connections}
          metrics={metrics}
          settings={settings}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          selectedConnId={selectedConnId}
          setSelectedConnId={setSelectedConnId}
          isConnecting={isConnecting}
          setIsConnecting={setIsConnecting}
          connectSourceId={connectSourceId}
          setConnectSourceId={setConnectSourceId}
          onAddStation={addStation}
          onAddConnection={addConnection}
          onDelete={handleDelete}
          duplicateStation={duplicateStation}
          updateStation={updateStation}
          updateConnection={updateConnection}
        />

        <PropertiesPanel 
          selectedId={selectedId}
          selectedConnId={selectedConnId}
          stations={stations}
          connections={connections}
          metrics={metrics}
          settings={settings}
          updateStation={updateStation}
          updateConnection={updateConnection}
          setSelectedId={setSelectedId}
          setSelectedConnId={setSelectedConnId}
        />
      </div>

      <div 
        onMouseDown={handleMouseDown}
        className="h-1.5 bg-slate-200 hover:bg-blue-400 cursor-row-resize transition-colors flex items-center justify-center group z-30"
      >
        <div className="w-12 h-1 bg-slate-300 group-hover:bg-white rounded-full flex items-center justify-center">
          <GripHorizontal size={10} className="text-slate-400 group-hover:text-blue-600" />
        </div>
      </div>

      <SummaryPanel 
        metrics={metrics}
        stations={stations}
        connections={connections}
        settings={settings}
        height={summaryHeight}
      />

      {/* VSM Timelines at the bottom */}
      {settings.showVsmInfo && metrics.criticalPathStationIds.length > 0 && (
        <div className="bg-white border-t border-slate-200 p-4 z-10">
          {/* Critical Path Timeline */}
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Critical Path Timeline</h3>
          <div className="flex items-center gap-2 mb-6">
            {metrics.criticalPathStationIds.map((id, index) => {
              const station = stations.find(s => s.id === id);
              return (
                <React.Fragment key={id}>
                  <div className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100">
                    {station?.name}
                  </div>
                  {index < metrics.criticalPathStationIds.length - 1 && (
                    <div className="w-4 h-px bg-slate-300" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* VSM Lead Time Timeline (Saw) */}
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">VSM Lead Time Timeline</h3>
          <svg width="100%" height="100">
            {(() => {
              const cpStations = metrics.criticalPathStationIds.map(id => stations.find(s => s.id === id)!);
              let currentX = 0;
              const stepWidth = 100;
              const points: string[] = [];
              
              cpStations.forEach((s, i) => {
                const isInv = s.type === 'inventory';
                const flowFactor = metrics.flowFactors?.[s.id] || 0;
                const maxStationLoad = stations.reduce((max, st) => {
                  if (st.type === 'inventory') return max;
                  const ff = metrics.flowFactors?.[st.id] || 0;
                  const isAutoBalanced = st.isAutoBalanced || settings.autoBalanceAll;
                  const workers = isAutoBalanced 
                    ? Math.max(1, Math.ceil((st.cycleTime * ff) / metrics.adjustedTakt))
                    : st.workers;
                  const load = (st.cycleTime / workers) * ff;
                  return Math.max(max, load);
                }, 0);
                const systemTaktActual = Math.max(metrics.adjustedTakt, maxStationLoad);
                
                const time = isInv 
                  ? (flowFactor > 0 ? (s.targetInventory || 0) * systemTaktActual / flowFactor : 0)
                  : (s.cycleTime / ((s.isAutoBalanced || settings.autoBalanceAll) ? Math.max(1, Math.ceil((s.cycleTime * flowFactor) / metrics.adjustedTakt)) : s.workers));

                if (i === 0) points.push(`M 0 ${isInv ? 0 : 40}`);
                
                if (isInv) {
                  points.push(`L ${currentX + stepWidth} 0`);
                  points.push(`L ${currentX + stepWidth} 40`);
                } else {
                  points.push(`L ${currentX + stepWidth} 40`);
                  points.push(`L ${currentX + stepWidth} 0`);
                }
                
                currentX += stepWidth;
              });

              return (
                <g>
                  <path d={points.join(' ')} fill="none" stroke="#cbd5e1" strokeWidth="2" />
                  {cpStations.map((s, i) => {
                    const isInv = s.type === 'inventory';
                    const flowFactor = metrics.flowFactors?.[s.id] || 0;
                    const maxStationLoad = stations.reduce((max, st) => {
                      if (st.type === 'inventory') return max;
                      const ff = metrics.flowFactors?.[st.id] || 0;
                      const isAutoBalanced = st.isAutoBalanced || settings.autoBalanceAll;
                      const workers = isAutoBalanced 
                        ? Math.max(1, Math.ceil((st.cycleTime * ff) / metrics.adjustedTakt))
                        : st.workers;
                      const load = (st.cycleTime / workers) * ff;
                      return Math.max(max, load);
                    }, 0);
                    const systemTaktActual = Math.max(metrics.adjustedTakt, maxStationLoad);
                    
                    const time = isInv 
                      ? (flowFactor > 0 ? (s.targetInventory || 0) * systemTaktActual / flowFactor : 0)
                      : (s.cycleTime / ((s.isAutoBalanced || settings.autoBalanceAll) ? Math.max(1, Math.ceil((s.cycleTime * flowFactor) / metrics.adjustedTakt)) : s.workers));
                    
                    const x1 = i * 100;
                    const x2 = (i + 1) * 100;

                    return (
                      <g key={`vsm-${s.id}`}>
                        <text x={(x1 + x2) / 2} y={isInv ? 10 : 70} textAnchor="middle" className="text-[10px] font-mono font-bold fill-slate-600">
                          {time.toFixed(1)}m
                        </text>
                        <text x={(x1 + x2) / 2} y={isInv ? 22 : 82} textAnchor="middle" className="text-[8px] font-bold fill-slate-400 uppercase">
                          {s.name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </svg>
        </div>
      )}
    </div>
  );
}
