import { useState, useCallback } from 'react';
import { AssemblyLine, Station, Connection, GlobalSettings } from '../types';

const INITIAL_LINE: AssemblyLine = {
  id: 'line1',
  name: 'Main Line',
  stations: [
    { id: 's1', name: 'Prep', cycleTime: 6, fte: 1, x: 100, y: 200, type: 'station' },
    { id: 's2', name: 'Assembly', cycleTime: 10, fte: 2, x: 350, y: 100, type: 'station' },
    { id: 's3', name: 'Weld', cycleTime: 8, fte: 1, x: 350, y: 300, type: 'station' },
    { id: 's4', name: 'Pack', cycleTime: 5, fte: 1, x: 600, y: 200, type: 'station' }
  ],
  connections: [
    { id: 'c1', sourceId: 's1', targetId: 's2', splitPercent: 50, isRework: false },
    { id: 'c2', sourceId: 's1', targetId: 's3', splitPercent: 50, isRework: false },
    { id: 'c3', sourceId: 's2', targetId: 's4', splitPercent: 100, isRework: false },
    { id: 'c4', sourceId: 's3', targetId: 's4', splitPercent: 100, isRework: false }
  ]
};

const SUB_ASSEMBLY_LINE: AssemblyLine = {
  id: 'line2',
  name: 'Sub-Assembly Demo',
  stations: [
    { id: 'a', name: 'A (Main)', cycleTime: 5, fte: 1, x: 50, y: 200, type: 'station' },
    { id: 'b', name: 'B', cycleTime: 5, fte: 1, x: 200, y: 100, type: 'station' },
    { id: 'c', name: 'C', cycleTime: 5, fte: 1, x: 350, y: 100, type: 'station' },
    { id: 'd', name: 'D (Sub)', cycleTime: 5, fte: 1, x: 200, y: 300, type: 'station' },
    { id: 'e', name: 'E (Assembly)', cycleTime: 5, fte: 1, x: 500, y: 200, type: 'station', flowMode: 'assembly' },
    { id: 'new', name: 'New Parts', cycleTime: 0, fte: 0, x: 350, y: 300, type: 'inventory', targetInventory: 10 },
    { id: 'buf1', name: 'Buffer C-E', cycleTime: 0, fte: 0, x: 425, y: 100, type: 'inventory', targetInventory: 5 },
    { id: 'buf2', name: 'Buffer D-E', cycleTime: 0, fte: 0, x: 425, y: 300, type: 'inventory', targetInventory: 5 }
  ],
  connections: [
    { id: 'c1', sourceId: 'a', targetId: 'b', splitPercent: 100, isRework: false },
    { id: 'c2', sourceId: 'b', targetId: 'c', splitPercent: 100, isRework: false },
    { id: 'c3', sourceId: 'c', targetId: 'buf1', splitPercent: 100, isRework: false },
    { id: 'c4', sourceId: 'buf1', targetId: 'e', splitPercent: 100, isRework: false },
    { id: 'c5', sourceId: 'a', targetId: 'd', splitPercent: 30, isRework: false },
    { id: 'c6', sourceId: 'd', targetId: 'buf2', splitPercent: 100, isRework: false },
    { id: 'c7', sourceId: 'buf2', targetId: 'e', splitPercent: 100, isRework: false },
    { id: 'c8', sourceId: 'new', targetId: 'e', splitPercent: 70, isRework: false }
  ]
};

export function useAssemblyLine() {
  const [lines, setLines] = useState<AssemblyLine[]>([INITIAL_LINE, SUB_ASSEMBLY_LINE]);
  const [history, setHistory] = useState<AssemblyLine[][]>([[INITIAL_LINE, SUB_ASSEMBLY_LINE]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeLineId, setActiveLineId] = useState<string>(INITIAL_LINE.id);
  const [settings, setSettings] = useState<GlobalSettings>({
    demand: 100,
    availableHours: 8,
    autoBalanceAll: false
  });

  const commitLines = useCallback((newLines: AssemblyLine[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newLines);
    if (newHistory.length > 50) newHistory.shift(); // Limit history to 50
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setLines(newLines);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLines(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLines(history[newIndex]);
    }
  }, [history, historyIndex]);

  const activeLine = lines.find(l => l.id === activeLineId) || lines[0];
  const { stations, connections } = activeLine;

  const updateActiveLine = useCallback((updates: Partial<AssemblyLine>) => {
    commitLines(lines.map(l => l.id === activeLineId ? { ...l, ...updates } : l));
  }, [activeLineId, lines, commitLines]);

  const updateStation = useCallback((id: string, updates: Partial<Station>) => {
    commitLines(lines.map(line => {
      if (line.stations.some(s => s.id === id)) {
        return {
          ...line,
          stations: line.stations.map(s => s.id === id ? { ...s, ...updates } : s)
        };
      }
      return line;
    }));
  }, [lines, commitLines]);

  const updateConnection = useCallback((id: string, updates: Partial<Connection>) => {
    commitLines(lines.map(line => {
      if (line.connections.some(c => c.id === id)) {
        return {
          ...line,
          connections: line.connections.map(c => c.id === id ? { ...c, ...updates } : c)
        };
      }
      return line;
    }));
  }, [lines, commitLines]);

  const addStation = useCallback((type: 'station' | 'inventory' | 'machine' = 'station') => {
    const newStation: Station = {
      id: `s${Date.now()}`,
      name: type === 'station' ? `Station ${stations.length + 1}` : type === 'machine' ? `Machine ${stations.length + 1}` : `Buffer ${stations.length + 1}`,
      cycleTime: type === 'station' ? 5 : type === 'machine' ? 10 : 0,
      fte: type === 'station' ? 1 : 0,
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      type,
      capacity: type === 'inventory' ? 100 : undefined,
      targetInventory: type === 'inventory' ? 10 : undefined,
      batchSize: type === 'machine' ? 1 : undefined
    };
    commitLines(lines.map(l => l.id === activeLineId ? { ...l, stations: [...l.stations, newStation] } : l));
    return newStation.id;
  }, [lines, activeLineId, commitLines]);

  const addConnection = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return null;
    if (connections.some(c => c.sourceId === sourceId && c.targetId === targetId)) return null;
    
    const newConn: Connection = {
      id: `c${Date.now()}`,
      sourceId,
      targetId,
      splitPercent: 100,
      isRework: false
    };
    commitLines(lines.map(l => l.id === activeLineId ? { ...l, connections: [...l.connections, newConn] } : l));
    return newConn.id;
  }, [lines, activeLineId, commitLines]);

  const deleteElement = useCallback((id: string, type: 'station' | 'connection') => {
    commitLines(lines.map(line => {
      if (line.id !== activeLineId) return line;
      if (type === 'station') {
        return {
          ...line,
          stations: line.stations.filter(s => s.id !== id),
          connections: line.connections.filter(c => c.sourceId !== id && c.targetId !== id)
        };
      } else {
        return {
          ...line,
          connections: line.connections.filter(c => c.id !== id)
        };
      }
    }));
  }, [lines, activeLineId, commitLines]);

  const duplicateStation = useCallback((station: Station) => {
    const newStation: Station = {
      ...station,
      id: `s${Date.now()}`,
      name: `${station.name} (Copy)`,
      x: station.x + 30,
      y: station.y + 30
    };
    commitLines(lines.map(l => l.id === activeLineId ? { ...l, stations: [...l.stations, newStation] } : l));
    return newStation.id;
  }, [lines, activeLineId, commitLines]);

  return {
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
    setLines: commitLines,
    undo,
    redo
  };
}
