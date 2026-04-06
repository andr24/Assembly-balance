import { useState, useCallback } from 'react';
import { AssemblyLine, Station, Connection, GlobalSettings } from '../types';

const INITIAL_LINE: AssemblyLine = {
  id: 'line1',
  name: 'Main Line',
  stations: [
    { id: 's1', name: 'Prep', cycleTime: 6, workers: 1, x: 100, y: 200, type: 'station' },
    { id: 's2', name: 'Assembly', cycleTime: 10, workers: 2, x: 350, y: 100, type: 'station' },
    { id: 's3', name: 'Weld', cycleTime: 8, workers: 1, x: 350, y: 300, type: 'station' },
    { id: 's4', name: 'Pack', cycleTime: 5, workers: 1, x: 600, y: 200, type: 'station' }
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
    { id: 'a', name: 'A (Main)', cycleTime: 5, workers: 1, x: 50, y: 200, type: 'station' },
    { id: 'b', name: 'B', cycleTime: 5, workers: 1, x: 200, y: 100, type: 'station' },
    { id: 'c', name: 'C', cycleTime: 5, workers: 1, x: 350, y: 100, type: 'station' },
    { id: 'd', name: 'D (Sub)', cycleTime: 5, workers: 1, x: 200, y: 300, type: 'station' },
    { id: 'e', name: 'E (Assembly)', cycleTime: 5, workers: 1, x: 500, y: 200, type: 'station', flowMode: 'assembly' },
    { id: 'new', name: 'New Parts', cycleTime: 0, workers: 0, x: 350, y: 300, type: 'inventory', targetInventory: 10 },
    { id: 'buf1', name: 'Buffer C-E', cycleTime: 0, workers: 0, x: 425, y: 100, type: 'inventory', targetInventory: 5 },
    { id: 'buf2', name: 'Buffer D-E', cycleTime: 0, workers: 0, x: 425, y: 300, type: 'inventory', targetInventory: 5 }
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
  const [activeLineId, setActiveLineId] = useState<string>(INITIAL_LINE.id);
  const [settings, setSettings] = useState<GlobalSettings>({
    demand: 100,
    availableHours: 8,
    autoBalanceAll: false
  });

  const activeLine = lines.find(l => l.id === activeLineId) || lines[0];
  const { stations, connections } = activeLine;

  const updateActiveLine = useCallback((updates: Partial<AssemblyLine>) => {
    setLines(prev => prev.map(l => l.id === activeLineId ? { ...l, ...updates } : l));
  }, [activeLineId]);

  const updateStation = useCallback((id: string, updates: Partial<Station>) => {
    updateActiveLine({
      stations: stations.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  }, [stations, updateActiveLine]);

  const updateConnection = useCallback((id: string, updates: Partial<Connection>) => {
    updateActiveLine({
      connections: connections.map(c => c.id === id ? { ...c, ...updates } : c)
    });
  }, [connections, updateActiveLine]);

  const addStation = useCallback((type: 'station' | 'inventory' = 'station') => {
    const newStation: Station = {
      id: `s${Date.now()}`,
      name: type === 'station' ? `Station ${stations.length + 1}` : `Buffer ${stations.length + 1}`,
      cycleTime: type === 'station' ? 5 : 0,
      workers: type === 'station' ? 1 : 0,
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      type,
      capacity: type === 'inventory' ? 100 : undefined,
      targetInventory: type === 'inventory' ? 10 : undefined
    };
    updateActiveLine({ stations: [...stations, newStation] });
    return newStation.id;
  }, [stations, updateActiveLine]);

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
    updateActiveLine({ connections: [...connections, newConn] });
    return newConn.id;
  }, [connections, updateActiveLine]);

  const deleteElement = useCallback((id: string, type: 'station' | 'connection') => {
    if (type === 'station') {
      updateActiveLine({
        stations: stations.filter(s => s.id !== id),
        connections: connections.filter(c => c.sourceId !== id && c.targetId !== id)
      });
    } else {
      updateActiveLine({
        connections: connections.filter(c => c.id !== id)
      });
    }
  }, [stations, connections, updateActiveLine]);

  const duplicateStation = useCallback((station: Station) => {
    const newStation: Station = {
      ...station,
      id: `s${Date.now()}`,
      name: `${station.name} (Copy)`,
      x: station.x + 30,
      y: station.y + 30
    };
    updateActiveLine({ stations: [...stations, newStation] });
    return newStation.id;
  }, [stations, updateActiveLine]);

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
    setLines
  };
}
