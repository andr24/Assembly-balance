import { useState, useCallback } from 'react';
import { AssemblyLine, Station, Connection, GlobalSettings, Group } from '../types';

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
  name: 'Complex Hybrid Factory',
  stations: [
    // --- Inputs ---
    { id: 'chassis', name: 'Chassis Weld', cycleTime: 10, fte: 2, x: 50, y: 300, type: 'machine', batchSize: 1 },
    
    // Wheels (50/50 Mix: 2 internal, 2 external per car)
    { id: 'whl_int', name: 'Internal Wheels', cycleTime: 4, fte: 2, x: 50, y: 150, type: 'machine', batchSize: 1 },
    { id: 'whl_ext', name: 'Kanban Wheels (Ext)', cycleTime: 0, fte: 0, x: 50, y: 50, type: 'inventory', isKanbanSource: true },
    
    // Engine (OR Logic: Try internal first, then Kanban backup)
    { id: 'eng_int', name: 'Engine Build', cycleTime: 15, fte: 3, x: 50, y: 450, type: 'machine', batchSize: 1 },
    { id: 'eng_ext', name: 'Supplier Backup Engines', cycleTime: 0, fte: 0, x: 50, y: 550, type: 'inventory', isKanbanSource: true },
    
    // --- Main Assembly ---
    { id: 'main', name: 'Main Assembly', cycleTime: 15, fte: 4, x: 350, y: 300, type: 'station', flowMode: 'assembly' },
    
    // --- Splitting (Routes) ---
    { id: 'std_finish', name: 'Standard Finish', cycleTime: 8, fte: 2, x: 600, y: 200, type: 'station' },
    { id: 'prm_finish', name: 'Premium Trim', cycleTime: 14, fte: 3, x: 600, y: 400, type: 'station' },
    
    // --- QA & Rework ---
    { id: 'qa', name: 'Premium QA', cycleTime: 5, fte: 1, x: 800, y: 400, type: 'station' },
    { id: 'ship', name: 'Shipping Dock', cycleTime: 2, fte: 1, x: 1000, y: 300, type: 'station' }
  ],
  connections: [
    // Feeds to Main Assembly
    { id: 'c1', sourceId: 'chassis', targetId: 'main', splitPercent: 100, isRework: false, inputGroup: 'chassis', partsPerAssembly: 1 },
    { id: 'c2', sourceId: 'whl_int', targetId: 'main', splitPercent: 100, isRework: false, inputGroup: 'wheel_int', partsPerAssembly: 2 },
    { id: 'c3', sourceId: 'whl_ext', targetId: 'main', splitPercent: 100, isRework: false, inputGroup: 'wheel_ext', partsPerAssembly: 2 },
    
    // OR Logic: Notice they share the exact same 'engine' input group, simulation pulls from whatever is available!
    { id: 'c4', sourceId: 'eng_int', targetId: 'main', splitPercent: 100, isRework: false, inputGroup: 'engine', partsPerAssembly: 1 },
    { id: 'c5', sourceId: 'eng_ext', targetId: 'main', splitPercent: 100, isRework: false, inputGroup: 'engine', partsPerAssembly: 1 },
    
    // Volume Splitting (70% Standard, 30% Premium)
    { id: 'c6', sourceId: 'main', targetId: 'std_finish', splitPercent: 70, isRework: false },
    { id: 'c7', sourceId: 'main', targetId: 'prm_finish', splitPercent: 30, isRework: false },
    
    // Converging Logic
    { id: 'c8', sourceId: 'std_finish', targetId: 'ship', splitPercent: 100, isRework: false },
    { id: 'c9', sourceId: 'prm_finish', targetId: 'qa', splitPercent: 100, isRework: false },
    
    // Quality Split & Rework Loop
    { id: 'c10', sourceId: 'qa', targetId: 'ship', splitPercent: 90, isRework: false },
    { id: 'c11', sourceId: 'qa', targetId: 'prm_finish', splitPercent: 10, isRework: true, waypoints: [{ x: 700, y: 500 }] }
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
    enableAI: true,
    showHeatmap: true
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
  const { stations, connections, groups = [] } = activeLine;

  const addGroup = useCallback((stationIds: string[]) => {
    const groupStations = stations.filter(s => stationIds.includes(s.id));
    if (groupStations.length === 0) return null;

    const minX = Math.min(...groupStations.map(s => s.x));
    const minY = Math.min(...groupStations.map(s => s.y));
    const maxX = Math.max(...groupStations.map(s => s.x + 100)); // Assuming 100 width
    const maxY = Math.max(...groupStations.map(s => s.y + 50)); // Assuming 50 height

    const newGroup: Group = {
      id: `g${Date.now()}`,
      name: `Group ${groups.length + 1}`,
      stationIds,
      x: minX - 20,
      y: minY - 20,
      width: maxX - minX + 40,
      height: maxY - minY + 40
    };
    commitLines(lines.map(l => l.id === activeLineId ? { ...l, groups: [...(l.groups || []), newGroup] } : l));
    return newGroup.id;
  }, [lines, activeLineId, commitLines, stations, groups.length]);

  const updateGroup = useCallback((id: string, updates: Partial<Group>) => {
    commitLines(lines.map(line => {
      if (line.id !== activeLineId || !line.groups) return line;
      return {
        ...line,
        groups: line.groups.map(g => g.id === id ? { ...g, ...updates } : g)
      };
    }));
  }, [lines, activeLineId, commitLines]);

  const deleteGroup = useCallback((id: string) => {
    commitLines(lines.map(line => {
      if (line.id !== activeLineId || !line.groups) return line;
      return {
        ...line,
        groups: line.groups.filter(g => g.id !== id)
      };
    }));
  }, [lines, activeLineId, commitLines]);

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
      flowMode: 'additive',
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
    setLines: commitLines,
    undo,
    redo
  };
}
