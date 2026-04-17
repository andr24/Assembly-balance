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
import { BalancerPage } from './components/BalancerPage';
import { SimulationPage } from './components/SimulationPage';
import { GripHorizontal, Settings2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const {
    lines,
    activeLineId,
    setActiveLineId,
    settings,
    setSettings,
    stations,
    connections,
    groups,
    updateStation,
    updateConnection,
    addGroup,
    updateGroup,
    deleteGroup,
    addStation,
    addConnection,
    deleteElement,
    duplicateStation,
    updateActiveLine,
    setLines,
    undo,
    redo
  } = useAssemblyLine();

  const metrics = useMetrics(stations, connections, settings);

  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [summaryHeight, setSummaryHeight] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const [currentView, setCurrentView] = useState<'editor' | 'balancer' | 'simulator'>('editor');
  const [showProperties, setShowProperties] = useState(false);

  // Auto-toggle properties panel based on selection
  React.useEffect(() => {
    const hasSelection = !!(selectedStationIds.length > 0 || selectedGroupId || selectedConnId);
    setShowProperties(hasSelection);
  }, [selectedStationIds, selectedGroupId, selectedConnId]);

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

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleExportExcel = () => {
    const data = stations.map(s => {
      const flowFactor = metrics.flowFactors?.[s.id] || 0;
      const workers = s.fte;
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
          setLines([...lines, ...imported.lines]);
          setActiveLineId(imported.lines[0].id);
        }
      } catch (err) {
        console.error("Failed to import JSON", err);
      }
    };
    reader.readAsText(file);
  };

  const handleExportJSON = () => {
    const activeLine = lines.find(l => l.id === activeLineId);
    const data = JSON.stringify({ lines: activeLine ? [activeLine] : [], settings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeLine?.name || 'AssemblyLine'}_Config.json`;
    a.click();
  };

  const handleDelete = () => {
    if (selectedStationIds.length > 0) {
      selectedStationIds.forEach(id => deleteElement(id, 'station'));
      setSelectedStationIds([]);
    } else if (selectedConnId) {
      deleteElement(selectedConnId, 'connection');
      setSelectedConnId(null);
    } else if (selectedGroupId) {
      deleteGroup(selectedGroupId);
      setSelectedGroupId(null);
    }
  };

  if (currentView === 'balancer') {
    return (
      <BalancerPage 
        lines={lines}
        settings={settings}
        onBack={() => setCurrentView('editor')}
        onApply={(newLines) => {
          setLines(newLines);
        }}
      />
    );
  }

  if (currentView === 'simulator') {
    return (
      <SimulationPage 
        lines={lines}
        settings={settings}
        setSettings={setSettings}
        onBack={() => setCurrentView('editor')}
      />
    );
  }

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
        selectedIds={selectedStationIds}
        selectedConnId={selectedConnId}
        isConnecting={isConnecting}
        setIsConnecting={setIsConnecting}
        onOpenBalancer={() => setCurrentView('balancer')}
        onOpenSimulator={() => setCurrentView('simulator')}
        stations={stations}
        addGroup={addGroup}
      />

      <div className="flex-1 flex overflow-hidden lg:flex-row flex-col relative">
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <Canvas 
            stations={stations}
            connections={connections}
            groups={groups}
            metrics={metrics}
            settings={settings}
            selectedStationIds={selectedStationIds}
            setSelectedStationIds={setSelectedStationIds}
            selectedGroupId={selectedGroupId}
            setSelectedGroupId={setSelectedGroupId}
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
            updateGroup={updateGroup}
            deleteGroup={deleteGroup}
            addGroup={addGroup}
          />
          
        </div>

        <motion.div 
          initial={false}
          animate={{ 
            width: showProperties ? (window.innerWidth < 1024 ? '100%' : 320) : 0,
            opacity: showProperties ? 1 : 0
          }}
          className={cn(
            "lg:relative absolute right-0 top-0 bottom-0 z-40 bg-white border-l border-slate-200 flex flex-col shadow-xl overflow-hidden",
            !showProperties && "border-none"
          )}
        >
          <div className="min-w-[320px] h-full flex flex-col">
            <PropertiesPanel 
              selectedStationIds={selectedStationIds}
              selectedGroupId={selectedGroupId}
              selectedConnId={selectedConnId}
              stations={stations}
              connections={connections}
              metrics={metrics}
              settings={settings}
              lines={lines}
              activeLineId={activeLineId}
              updateStation={updateStation}
              updateConnection={updateConnection}
              updateGroup={updateGroup}
              deleteGroup={deleteGroup}
              setSelectedStationIds={setSelectedStationIds}
              setSelectedGroupId={setSelectedGroupId}
              setSelectedConnId={setSelectedConnId}
              onClose={() => {
                setSelectedStationIds([]);
                setSelectedGroupId(null);
                setSelectedConnId(null);
              }}
            />
          </div>
        </motion.div>
      </div>

      <div 
        onMouseDown={handleMouseDown}
        className="h-1.5 bg-slate-200 hover:bg-blue-400 cursor-row-resize transition-colors lg:flex hidden items-center justify-center group z-30"
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
    </div>
  );
}
