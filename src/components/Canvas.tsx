import React, { useRef, useState } from 'react';
import { MousePointer2, Link2, Plus, Trash2, RefreshCw, AlertCircle, Box, User, Cpu, Package, LayoutDashboard } from 'lucide-react';
import { Station, Connection, Metrics, GlobalSettings, Group } from '../types';
import { STATION_WIDTH, STATION_HEIGHT, INVENTORY_WIDTH, INVENTORY_HEIGHT } from '../constants';
import { cn } from '../lib/utils';
import { MiniMap } from './MiniMap';
import { autoLayout } from '../utils/layout';
import { TooltipWrapper } from './TooltipWrapper';

interface CanvasProps {
  stations: Station[];
  connections: Connection[];
  groups: Group[];
  metrics: Metrics;
  settings: GlobalSettings;
  selectedStationIds: string[];
  setSelectedStationIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedGroupId: string | null;
  setSelectedGroupId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedConnId: string | null;
  setSelectedConnId: React.Dispatch<React.SetStateAction<string | null>>;
  isConnecting: boolean;
  setIsConnecting: (b: boolean) => void;
  connectSourceId: string | null;
  setConnectSourceId: (id: string | null) => void;
  onAddStation: (type: 'station' | 'inventory' | 'machine') => void;
  onAddConnection: (sourceId: string, targetId: string) => void;
  onDelete: () => void;
  duplicateStation: (station: Station) => string;
  updateStation: (id: string, updates: Partial<Station>) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  addGroup: (stationIds: string[]) => void;
}

export function Canvas({
  stations,
  connections,
  groups,
  metrics,
  settings,
  selectedStationIds,
  setSelectedStationIds,
  selectedGroupId,
  setSelectedGroupId,
  selectedConnId,
  setSelectedConnId,
  isConnecting,
  setIsConnecting,
  connectSourceId,
  setConnectSourceId,
  onAddStation,
  onAddConnection,
  onDelete,
  duplicateStation,
  updateStation,
  updateConnection,
  updateGroup,
  deleteGroup,
  addGroup
}: CanvasProps) {
  const canvasRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragWaypoint, setDragWaypoint] = useState<{ connId: string; index: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [clipboard, setClipboard] = useState<Station | null>(null);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [resizingGroup, setResizingGroup] = useState<{ id: string, initialWidth: number, initialHeight: number, initialX: number, initialY: number } | null>(null);

  const handleResizeStart = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    setResizingGroup({
      id: group.id,
      initialWidth: group.width,
      initialHeight: group.height,
      initialX: e.clientX,
      initialY: e.clientY
    });
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingGroup) return;
    const dx = (e.clientX - resizingGroup.initialX) / zoom;
    const dy = (e.clientY - resizingGroup.initialY) / zoom;
    
    updateGroup(resizingGroup.id, {
      width: Math.max(50, resizingGroup.initialWidth + dx),
      height: Math.max(50, resizingGroup.initialHeight + dy)
    });
  };

  const handleResizeEnd = () => {
    setResizingGroup(null);
  };

  React.useEffect(() => {
    if (resizingGroup) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    } else {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [resizingGroup]);
  const [hasMoved, setHasMoved] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        onDelete();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedStationIds.length > 0) {
          const station = stations.find(s => s.id === selectedStationIds[0]);
          if (station) setClipboard(station);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard) {
          const newId = duplicateStation(clipboard);
          setSelectedStationIds([newId]);
          setSelectedConnId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStationIds, selectedConnId, onDelete, stations, clipboard, duplicateStation, setSelectedStationIds, setSelectedConnId]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (hasMoved) return;
    setSelectedStationIds([]);
    setSelectedGroupId(null);
    setSelectedConnId(null);
    setIsConnecting(false);
    setConnectSourceId(null);
  };

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  };

  const handleStationMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (e.button === 1 || (e.button === 0 && e.altKey)) return; // Middle click or Alt+Left for pan

    if (isConnecting) {
      if (connectSourceId && connectSourceId !== id) {
        onAddConnection(connectSourceId, id);
        setConnectSourceId(null);
        setIsConnecting(false);
      } else {
        setConnectSourceId(id);
      }
      return;
    }

    if (e.shiftKey) {
      setSelectedStationIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
      setSelectedGroupId(null);
      setSelectedConnId(null);
    } else {
      setSelectedStationIds([id]);
      setSelectedGroupId(null);
      setSelectedConnId(null);
    }
    
    setIsDragging(true);
    const s = stations.find(st => st.id === id)!;
    const worldPos = screenToWorld(e.clientX, e.clientY);
    setDragOffset({ x: worldPos.x - s.x, y: worldPos.y - s.y });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setHasMoved(false);
    const isBackground = e.target === canvasRef.current || (e.target as SVGElement).id === 'grid-bg';
    
    if (e.button === 1 || (e.button === 0 && (e.altKey || isBackground))) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        setHasMoved(true);
      }
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isDragging && selectedStationIds.length > 0) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      selectedStationIds.forEach(id => {
        const s = stations.find(st => st.id === id);
        if (s) {
          updateStation(id, {
            x: Math.max(0, worldPos.x - dragOffset.x),
            y: Math.max(0, worldPos.y - dragOffset.y)
          });
        }
      });
    } else if (dragWaypoint) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const conn = connections.find(c => c.id === dragWaypoint.connId);
      if (conn) {
        const newWaypoints = [...(conn.waypoints || [])];
        newWaypoints[dragWaypoint.index] = { 
          x: Math.max(0, worldPos.x), 
          y: Math.max(0, worldPos.y) 
        };
        updateConnection(dragWaypoint.connId, { waypoints: newWaypoints });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragWaypoint(null);
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100);
    const newZoom = Math.min(Math.max(zoom * factor, 0.1), 5);
    
    // Zoom relative to mouse position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX - pan.x) / zoom;
      const worldY = (mouseY - pan.y) / zoom;
      
      setPan({
        x: mouseX - worldX * newZoom,
        y: mouseY - worldY * newZoom
      });
      setZoom(newZoom);
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom * 1.2, 5);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom / 1.2, 0.1);
    setZoom(newZoom);
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  React.useEffect(() => {
    if (isDragging || dragWaypoint || isPanning) {
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
  }, [isDragging, dragWaypoint, isPanning, stations, connections, dragOffset, zoom, pan, lastMousePos]);

  const getSplitSum = (stationId: string) => {
    return connections
      .filter(c => c.sourceId === stationId && !c.isRework)
      .reduce((sum, c) => sum + c.splitPercent, 0);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 relative bg-slate-50">
      <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
        <div className="flex bg-white p-1 rounded-xl shadow-xl border border-slate-200">
          <button 
            onClick={() => setIsConnecting(false)}
            className={cn(
              "p-2 rounded-lg transition-all flex items-center gap-2 px-3",
              !isConnecting ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <MousePointer2 size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Select</span>
          </button>
          <button 
            onClick={() => setIsConnecting(true)}
            className={cn(
              "p-2 rounded-lg transition-all flex items-center gap-2 px-3",
              isConnecting ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <Link2 size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Connect</span>
          </button>
        </div>
        <div className="w-px h-8 bg-slate-300 mx-1" />
        <div className="flex bg-white p-1 rounded-xl shadow-xl border border-slate-200">
          <TooltipWrapper content="Automatically arrange stations in a clean layout">
            <button 
              onClick={() => {
                const newStations = autoLayout(stations, connections);
                newStations.forEach(s => updateStation(s.id, { x: s.x, y: s.y }));
              }}
              className="flex items-center gap-2 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg font-medium transition-all"
            >
              <RefreshCw size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Auto-Layout</span>
            </button>
          </TooltipWrapper>
          <div className="w-px h-8 bg-slate-300 mx-1" />
          <TooltipWrapper content="Add a new station">
            <button 
              onClick={() => onAddStation('station')}
              className="flex items-center gap-2 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg font-medium transition-all"
            >
              <Plus size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Station</span>
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Add a new machine">
            <button 
              onClick={() => onAddStation('machine')}
              className="flex items-center gap-2 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg font-medium transition-all"
            >
              <Plus size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Machine</span>
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Add a new inventory">
            <button 
              onClick={() => onAddStation('inventory')}
              className="flex items-center gap-2 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg font-medium transition-all"
            >
              <Box size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Inventory</span>
            </button>
          </TooltipWrapper>
        </div>
        <button 
          onClick={onDelete}
          disabled={(selectedStationIds.length === 0 && !selectedConnId && !selectedGroupId) || !!selectedGroupId}
          className="flex items-center gap-2 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:hover:bg-white px-3 py-2 rounded-lg font-medium transition-all shadow-xl border border-slate-200"
        >
          <Trash2 size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">Delete</span>
        </button>
        <button 
          onClick={() => addGroup(selectedStationIds)}
          disabled={selectedStationIds.length === 0}
          className="flex items-center gap-2 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white px-3 py-2 rounded-lg font-medium transition-all shadow-xl border border-slate-200"
        >
          <LayoutDashboard size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">Group</span>
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 left-6 flex items-center gap-2 z-10">
        <div className="flex bg-white p-1 rounded-xl shadow-xl border border-slate-200">
          <button 
            onClick={handleZoomOut}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            title="Zoom Out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <div className="w-12 flex items-center justify-center text-xs font-mono font-bold text-slate-500">
            {Math.round(zoom * 100)}%
          </div>
          <button 
            onClick={handleZoomIn}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            title="Zoom In"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button 
            onClick={handleResetZoom}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all border-l border-slate-100 ml-1"
            title="Reset Zoom"
          >
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={() => {
              if (stations.length === 0) return;
              const minX = Math.min(...stations.map(s => s.x));
              const maxX = Math.max(...stations.map(s => s.x + (s.type === 'inventory' ? INVENTORY_WIDTH : STATION_WIDTH)));
              const minY = Math.min(...stations.map(s => s.y));
              const maxY = Math.max(...stations.map(s => s.y + (s.type === 'inventory' ? INVENTORY_HEIGHT : STATION_HEIGHT)));
              
              const rect = canvasRef.current?.getBoundingClientRect();
              if (rect) {
                const padding = 100;
                const contentWidth = maxX - minX + padding * 2;
                const contentHeight = maxY - minY + padding * 2;
                
                const newZoom = Math.min(
                  rect.width / contentWidth,
                  rect.height / contentHeight,
                  1
                );
                
                setZoom(newZoom);
                setPan({
                  x: (rect.width - (maxX + minX) * newZoom) / 2,
                  y: (rect.height - (maxY + minY) * newZoom) / 2
                });
              }
            }}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            title="Center View"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
        </div>
      </div>

      {/* Heatmap Legend */}
      {settings.showHeatmap && (
        <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-slate-200 shadow-xl z-10 space-y-2">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-1">Utilization</h4>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-100 border border-red-500" />
              <span className="text-[10px] font-bold text-slate-600">&gt; 95% (Critical)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-500" />
              <span className="text-[10px] font-bold text-slate-600">80-95% (High)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-500" />
              <span className="text-[10px] font-bold text-slate-600">&lt; 80% (Balanced)</span>
            </div>
          </div>
        </div>
      )}

      <MiniMap 
        stations={stations} 
        connections={connections} 
        pan={pan} 
        zoom={zoom} 
        containerWidth={containerRef.current?.clientWidth || 0} 
        containerHeight={containerRef.current?.clientHeight || 0}
        onPan={(x, y) => setPan({ x, y })}
      />

      <div 
        ref={containerRef}
        className={cn(
          "flex-1 relative overflow-hidden touch-none",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <svg 
          ref={canvasRef}
          width="100%" 
          height="100%" 
          className="bg-slate-100"
          onClick={handleCanvasClick}
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 8 3 L 0 6 L 2 3 Z" fill="#64748b" />
            </marker>
            <marker id="arrowhead-rework" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 8 3 L 0 6 L 2 3 Z" fill="#ef4444" />
            </marker>
            <marker id="arrowhead-selected" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 8 3 L 0 6 L 2 3 Z" fill="#2563eb" />
            </marker>
            
            {/* Mid-path markers for flow direction */}
            <marker id="flow-arrow" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 6 2 L 0 4 L 1.5 2 Z" fill="#94a3b8" fillOpacity="0.6" />
            </marker>
            <marker id="flow-arrow-selected" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 6 2 L 0 4 L 1.5 2 Z" fill="#3b82f6" fillOpacity="0.8" />
            </marker>
            <marker id="flow-arrow-rework" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 6 2 L 0 4 L 1.5 2 Z" fill="#f87171" fillOpacity="0.8" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            </pattern>
            <rect id="grid-bg" x="-10000" y="-10000" width="20000" height="20000" fill="url(#grid)" />

            {groups.map(g => (
              <g key={g.id} transform={`translate(${g.x}, ${g.y})`}>
                <rect
                  width={g.width}
                  height={g.height}
                  rx="12"
                  fill="#f8fafc"
                  stroke={selectedGroupId === g.id ? "#2563eb" : "#cbd5e1"}
                  strokeWidth={selectedGroupId === g.id ? "2" : "2"}
                  strokeDasharray="4 4"
                  onClick={(e) => { e.stopPropagation(); setSelectedGroupId(g.id); setSelectedStationIds([]); setSelectedConnId(null); }}
                />
                <text x="10" y="20" className="text-xs font-bold fill-slate-500">{g.name}</text>
                
                {/* Resize Handle */}
                <rect
                  x={g.width - 12}
                  y={g.height - 12}
                  width="12"
                  height="12"
                  fill="#cbd5e1"
                  className="cursor-nwse-resize"
                  onMouseDown={(e) => handleResizeStart(e, g)}
                />
              </g>
            ))}

          {connections.map(conn => {
            const source = stations.find(s => s.id === conn.sourceId);
            const target = stations.find(s => s.id === conn.targetId);
            if (!source || !target) return null;

            const isSelected = selectedConnId === conn.id;
            
            const sourceWidth = source.type === 'inventory' ? INVENTORY_WIDTH : STATION_WIDTH;
            const sourceHeight = source.type === 'inventory' ? INVENTORY_HEIGHT : STATION_HEIGHT;
            const targetWidth = target.type === 'inventory' ? INVENTORY_WIDTH : STATION_WIDTH;
            const targetHeight = target.type === 'inventory' ? INVENTORY_HEIGHT : STATION_HEIGHT;

            const outgoing = connections.filter(c => c.sourceId === conn.sourceId);
            const connIndex = outgoing.findIndex(c => c.id === conn.id);
            const totalOutgoing = outgoing.length;
            
            const offsetStep = sourceHeight / (totalOutgoing + 1);
            
            // Adjust start/end points for inventory triangles
            let startX, startY, endX, endY;
            
            if (source.type === 'inventory') {
              // Right side of downward triangle: (width, 0) to (width/2, height)
              // Midpoint is (3*width/4, height/2)
              startX = source.x + (3 * sourceWidth) / 4;
              startY = source.y + sourceHeight / 2;
            } else {
              startX = source.x + sourceWidth;
              startY = source.y + offsetStep * (connIndex + 1);
            }
            
            if (target.type === 'inventory') {
              // Left side of downward triangle: (0, 0) to (width/2, height)
              // Midpoint is (width/4, height/2)
              endX = target.x + targetWidth / 4;
              endY = target.y + targetHeight / 2;
            } else {
              endX = target.x;
              endY = target.y + targetHeight / 2;
            }
            
            const dx = endX - startX;
            const dy = endY - startY;
            const cp1x = startX + Math.max(dx * 0.5, 50);
            const cp1y = startY;
            const cp2x = endX - Math.max(dx * 0.5, 50);
            const cp2y = endY;

            let pathData = "";
            const points = [
              { x: startX, y: startY },
              ...(conn.waypoints || []),
              { x: endX, y: endY }
            ];

            if (conn.waypoints && conn.waypoints.length > 0) {
              const radius = 30;
              pathData = `M ${points[0].x} ${points[0].y}`;
              
              for (let i = 1; i < points.length - 1; i++) {
                const p1 = points[i - 1];
                const p2 = points[i];
                const p3 = points[i + 1];

                const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
                const d1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                const n1 = { x: v1.x / d1, y: v1.y / d1 };

                const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
                const d2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
                const n2 = { x: v2.x / d2, y: v2.y / d2 };

                const r = Math.min(radius, d1 / 2, d2 / 2);

                const start = { x: p2.x + n1.x * r, y: p2.y + n1.y * r };
                const end = { x: p2.x + n2.x * r, y: p2.y + n2.y * r };

                // Add a midpoint between previous end (or start) and current start for the flow arrow
                const prevPoint = i === 1 ? points[0] : { x: points[i-1].x + (points[i].x - points[i-1].x) * (1 - r/Math.sqrt(Math.pow(points[i].x - points[i-1].x, 2) + Math.pow(points[i].y - points[i-1].y, 2))), y: points[i-1].y + (points[i].y - points[i-1].y) * (1 - r/Math.sqrt(Math.pow(points[i].x - points[i-1].x, 2) + Math.pow(points[i].y - points[i-1].y, 2))) };
                // Simplified: just put a vertex at the midpoint of the segment before the curve
                const midX = (points[i-1].x + start.x) / 2;
                const midY = (points[i-1].y + start.y) / 2;
                
                pathData += ` L ${midX} ${midY} L ${start.x} ${start.y} Q ${p2.x} ${p2.y}, ${end.x} ${end.y}`;
                
                if (i === points.length - 2) {
                  // Last segment midpoint
                  const lastMidX = (end.x + points[points.length - 1].x) / 2;
                  const lastMidY = (end.y + points[points.length - 1].y) / 2;
                  pathData += ` L ${lastMidX} ${lastMidY}`;
                }
              }
              pathData += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
            } else {
              const midX = 0.125 * startX + 0.375 * cp1x + 0.375 * cp2x + 0.125 * endX;
              const midY = 0.125 * startY + 0.375 * cp1y + 0.375 * cp2y + 0.125 * endY;

              const q1x = (startX + cp1x) / 2;
              const q1y = (startY + cp1y) / 2;
              const q2x = (cp1x + cp2x) / 2;
              const q2y = (cp1y + cp2y) / 2;
              const q3x = (cp2x + endX) / 2;
              const q3y = (cp2y + endY) / 2;

              const r1x = (q1x + q2x) / 2;
              const r1y = (q1y + q2y) / 2;
              const r2x = (q2x + q3x) / 2;
              const r2y = (q2y + q3y) / 2;

              pathData = `M ${startX} ${startY} C ${q1x} ${q1y} ${r1x} ${r1y} ${midX} ${midY} C ${r2x} ${r2y} ${q3x} ${q3y} ${endX} ${endY}`;
            }

            const markerX = conn.waypoints && conn.waypoints.length > 0 
              ? conn.waypoints[0].x 
              : startX + 30;
            const markerY = conn.waypoints && conn.waypoints.length > 0 
              ? conn.waypoints[0].y 
              : startY;

            return (
              <g key={conn.id} onClick={(e) => { e.stopPropagation(); setSelectedConnId(conn.id); setSelectedStationIds([]); }}>
                <path 
                  d={pathData}
                  fill="none"
                  stroke={isSelected ? "#2563eb" : (conn.isRework ? "#ef4444" : "#64748b")}
                  strokeWidth={isSelected ? 4 : 2}
                  strokeDasharray={conn.isRework ? "5,5" : "none"}
                  markerEnd={isSelected ? "url(#arrowhead-selected)" : (conn.isRework ? "url(#arrowhead-rework)" : "url(#arrowhead)")}
                  markerMid={isSelected ? "url(#flow-arrow-selected)" : (conn.isRework ? "url(#flow-arrow-rework)" : "url(#flow-arrow)")}
                  className="cursor-pointer transition-all hover:stroke-blue-400"
                />
                {!conn.isRework && (
                  <g transform={`translate(${markerX}, ${markerY})`} className="pointer-events-none">
                    <circle r="12" fill="white" stroke={isSelected ? "#2563eb" : "#e2e8f0"} strokeWidth="1" />
                    <text textAnchor="middle" dy=".3em" className="text-[9px] font-bold fill-blue-600">{conn.splitPercent}%</text>
                  </g>
                )}

                {/* Input Group Badge */}
                {conn.inputGroup && !conn.isRework && (
                  <g transform={`translate(${startX + dx * 0.7}, ${startY + dy * 0.7})`} className="pointer-events-none">
                    <rect x="-20" y="-8" width="40" height="16" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                    <text textAnchor="middle" dy=".3em" className="text-[8px] font-bold fill-slate-600">
                      {conn.inputGroup}
                    </text>
                  </g>
                )}
                {conn.isRework && (
                  <g transform={`translate(${markerX}, ${markerY})`} className="pointer-events-none">
                    <rect x="-20" y="-8" width="40" height="16" rx="4" fill="#fee2e2" />
                    <text textAnchor="middle" dy=".3em" className="text-[8px] font-bold fill-red-600 uppercase">Rework</text>
                  </g>
                )}
                <path d={pathData} fill="none" stroke="transparent" strokeWidth="15" className="cursor-pointer" />

                {isSelected && (
                  <g>
                    {/* Waypoint handles */}
                    {(conn.waypoints || []).map((wp, idx) => (
                      <circle
                        key={idx}
                        cx={wp.x}
                        cy={wp.y}
                        r="6"
                        fill="#2563eb"
                        className="cursor-move hover:r-8 transition-all"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDragWaypoint({ connId: conn.id, index: idx });
                        }}
                      />
                    ))}
                    
                    {/* Add waypoint handles on segments */}
                    {(() => {
                      const points = [
                        { x: startX, y: startY },
                        ...(conn.waypoints || []),
                        { x: endX, y: endY }
                      ];
                      
                      return points.slice(0, -1).map((p, i) => {
                        const next = points[i + 1];
                        const midX = (p.x + next.x) / 2;
                        const midY = (p.y + next.y) / 2;
                        
                        return (
                          <circle
                            key={`add-${i}`}
                            cx={midX}
                            cy={midY}
                            r="4"
                            fill="#2563eb"
                            fillOpacity="0.2"
                            className="cursor-pointer hover:fill-opacity-100 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newWaypoints = [...(conn.waypoints || [])];
                              newWaypoints.splice(i, 0, { x: midX, y: midY });
                              updateConnection(conn.id, { waypoints: newWaypoints });
                            }}
                          />
                        );
                      });
                    })()}
                  </g>
                )}
              </g>
            );
          })}

          {stations.map(s => {
            const isSelected = selectedStationIds.includes(s.id);
            const isBottleneck = s.id === metrics.bottleneckStationId;
            const isInventory = s.type === 'inventory';
            const isMachine = s.type === 'machine';
            const width = isInventory ? INVENTORY_WIDTH : STATION_WIDTH;
            const height = isInventory ? INVENTORY_HEIGHT : STATION_HEIGHT;

            // Heatmap calculation
            let utilization = 0;
            let heatmapColor = "white";
            let heatmapStroke = isSelected ? "#2563eb" : (isBottleneck ? "#f97316" : "#cbd5e1");

            if (!isInventory && settings.showHeatmap && metrics.systemTakt > 0) {
              const learningFactor = (s.learningCurve || 100) / 100;
              const setupPerUnit = (s.setupTime || 0) / (s.batchSize || 1);
              const handlingTime = (s.materialHandlingTime || 0);
              const fte = s.fte || 1;
              
              const effectiveCT = isMachine 
                ? (s.cycleTime / (s.batchSize || 1)) + setupPerUnit + handlingTime
                : (s.cycleTime / (fte * learningFactor)) + setupPerUnit + handlingTime;
              
              const flowFactor = metrics.flowFactors?.[s.id] || 0;
              const load = effectiveCT * flowFactor;
              utilization = (load / metrics.systemTakt) * 100;

              if (utilization > 95) {
                heatmapColor = "#fee2e2"; // Red-100
                heatmapStroke = "#ef4444"; // Red-500
              } else if (utilization > 80) {
                heatmapColor = "#fef9c3"; // Yellow-100
                heatmapStroke = "#eab308"; // Yellow-500
              } else {
                heatmapColor = "#dcfce7"; // Green-100
                heatmapStroke = "#22c55e"; // Green-500
              }
              
              if (isSelected) heatmapStroke = "#2563eb";
            } else if (isBottleneck && !isInventory) {
              heatmapColor = "#fff7ed";
              heatmapStroke = isSelected ? "#2563eb" : "#f97316";
            }

            return (
              <g 
                key={s.id} 
                transform={`translate(${s.x}, ${s.y})`}
                onMouseDown={(e) => handleStationMouseDown(e, s.id)}
                onClick={(e) => e.stopPropagation()}
                className="cursor-move select-none"
              >
                {isInventory ? (
                  <path 
                    d={`M 0 0 L ${width} 0 L ${width/2} ${height} Z`}
                    fill="white"
                    stroke={isSelected ? "#2563eb" : "#cbd5e1"}
                    strokeWidth={isSelected ? 3 : 2}
                    className="shadow-sm transition-all"
                  />
                ) : isMachine ? (
                  <rect 
                    width={width} 
                    height={height} 
                    rx="4"
                    fill={heatmapColor}
                    stroke={isMachine && isSelected ? "#9333ea" : heatmapStroke}
                    strokeWidth={isSelected || isBottleneck ? 4 : 2}
                    className="shadow-sm transition-all"
                  />
                ) : (
                  <rect 
                    width={width} 
                    height={height} 
                    rx="8"
                    fill={heatmapColor}
                    stroke={heatmapStroke}
                    strokeWidth={isSelected || isBottleneck ? 4 : 2}
                    className="shadow-sm transition-all"
                  />
                )}
                
                {isBottleneck && !isInventory && (
                  <g>
                    <rect 
                      x="-4" y="-4" 
                      width={width + 8} 
                      height={height + 8} 
                      rx={isMachine ? 8 : 12} 
                      fill="none" 
                      stroke="#f97316" 
                      strokeWidth="2" 
                      strokeOpacity="0.4"
                      className="animate-pulse" 
                    />
                    <rect width={width} height="6" rx="3" fill="#f97316" />
                    <text 
                      x={width / 2} 
                      y="-10" 
                      textAnchor="middle" 
                      className="text-[10px] font-black fill-orange-600 uppercase tracking-widest"
                    >
                      Bottleneck
                    </text>
                  </g>
                )}

                {s.flowMode === 'assembly' && !isInventory && (
                  <g transform={`translate(${width - 15}, ${height - 15})`}>
                    <circle r="8" fill="#3b82f6" />
                    <path d="M -3 -3 L 3 3 M -3 3 L 3 -3" stroke="white" strokeWidth="1.5" />
                    <title>Assembly Mode: Synchronizes incoming flows (takes max instead of sum).</title>
                  </g>
                )}

                {getSplitSum(s.id) !== 100 && connections.some(c => c.sourceId === s.id && !c.isRework) && (
                  <g transform={`translate(${width - 20}, 8)`}>
                    <circle r="8" fill="#ef4444" />
                    <text textAnchor="middle" dy=".3em" className="text-[10px] font-bold fill-white">!</text>
                    <title>Outgoing split percentages sum to {getSplitSum(s.id)}%. They should sum to 100%.</title>
                  </g>
                )}

                <text x={isInventory ? width/2 : 12} y={isInventory ? height + 15 : 24} textAnchor={isInventory ? "middle" : "start"} className="text-sm font-bold fill-slate-900">{s.name}</text>
                
                {/* Type Icon */}
                <g transform={`translate(${isInventory ? width/2 - 10 : width - 28}, ${isInventory ? 6 : 10})`} className="opacity-30 pointer-events-none fill-slate-400">
                  {isInventory ? <Package size={20} /> : (isMachine ? <Cpu size={20} /> : <User size={20} />)}
                </g>

                {s.isKanbanSource && (
                  <g transform={`translate(${isInventory ? width/2 : 12}, ${isInventory ? height - 10 : height - 12})`}>
                    <circle r="8" fill="#3b82f6" />
                    <text textAnchor="middle" dy=".3em" className="text-[10px] font-bold fill-white">K</text>
                    <title>Kanban Source: Infinite material supply.</title>
                  </g>
                )}

                {/* Start/Finish Badges */}
                {(() => {
                  const isStart = !connections.some(c => c.targetId === s.id && !c.isRework);
                  const isFinish = !connections.some(c => c.sourceId === s.id && !c.isRework);
                  
                  if (isStart || isFinish) {
                    return (
                      <g transform={`translate(${isInventory ? width/2 - 20 : width - 45}, ${isInventory ? -15 : 5})`}>
                        <rect 
                          width="40" 
                          height="14" 
                          rx="4" 
                          fill={isStart ? "#dcfce7" : "#fee2e2"} 
                          stroke={isStart ? "#86efac" : "#fecaca"} 
                          strokeWidth="1" 
                        />
                        <text 
                          x="20" 
                          y="10" 
                          textAnchor="middle" 
                          className={`text-[8px] font-black uppercase tracking-tighter ${isStart ? "fill-green-700" : "fill-red-700"}`}
                        >
                          {isStart ? "START" : "FINISH"}
                        </text>
                      </g>
                    );
                  }
                  return null;
                })()}
                
                {settings.showVsmInfo && isInventory && !s.isKanbanSource && (
                  <g transform={`translate(0, ${height + 25})`}>
                    {(() => {
                      const flowFactor = metrics.flowFactors?.[s.id] || 0;
                      const inventory = s.targetInventory || 0;
                      const systemTaktActual = metrics.systemTakt;
                      const leadTime = flowFactor > 0 ? (inventory * systemTaktActual / flowFactor) : 0;
                      
                      return (
                        <>
                          <rect x={width/2 - 30} width="60" height="30" rx="4" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1" />
                          <text x={width/2} y="12" textAnchor="middle" className="text-[8px] font-bold fill-orange-400 uppercase">Lead Time</text>
                          <text x={width/2} y="24" textAnchor="middle" className="text-[10px] font-mono font-bold fill-orange-700">
                            <title>{`Lead Time = (Inventory: ${inventory} * System Takt: ${systemTaktActual.toFixed(2)}) / Flow Factor: ${flowFactor.toFixed(2)}`}</title>
                            {leadTime.toFixed(1)}m
                          </text>
                        </>
                      );
                    })()}
                  </g>
                )}

                {settings.showVsmInfo && !isInventory && (
                  <g transform={`translate(0, ${height})`}>
                    <rect width={width} height="60" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                    <line x1="0" y1="20" x2={width} y2="20" stroke="#e2e8f0" />
                    <line x1="0" y1="40" x2={width} y2="40" stroke="#e2e8f0" />
                    <line x1={width/2} y1="0" x2={width/2} y2="60" stroke="#e2e8f0" />
                    
                    {/* Row 1 */}
                    <text x="6" y="14" className="text-[8px] font-bold fill-slate-400 uppercase">Eff. C/T</text>
                    <text x={width/2 - 6} y="14" textAnchor="end" className="text-[10px] font-mono font-bold fill-slate-700">
                      <title>Effective Cycle Time: Per-unit time including setup, batching, and FTE factors.</title>
                      {(() => {
                        const learningFactor = (s.learningCurve || 100) / 100;
                        const setupPerUnit = (s.setupTime || 0) / (s.batchSize || 1);
                        const handlingTime = (s.materialHandlingTime || 0);
                        const fte = s.fte || 1;
                        const effectiveCT = isMachine 
                          ? (s.cycleTime / (s.batchSize || 1)) + setupPerUnit + handlingTime
                          : (s.cycleTime / (fte * learningFactor)) + setupPerUnit + handlingTime;
                        return Number(effectiveCT.toFixed(2));
                      })()}m
                    </text>
                    
                    <text x={width/2 + 6} y="14" className="text-[8px] font-bold fill-slate-400 uppercase">{isMachine ? 'Cap' : 'FTE'}</text>
                    <text x={width - 6} y="14" textAnchor="end" className="text-[10px] font-mono font-bold fill-slate-700">
                      <title>
                        {isMachine ? 'Batch Size / Capacity' : 'Manual Assignment'}
                      </title>
                      {isMachine ? (s.batchSize || 1) : s.fte}
                    </text>

                    {/* Row 2 */}
                    <text x="6" y="34" className="text-[8px] font-bold fill-slate-400 uppercase">C/O</text>
                    <text x={width/2 - 6} y="34" textAnchor="end" className="text-[10px] font-mono font-bold fill-slate-700">
                      <title>Changeover Time: The time required to switch from producing one product type to another.</title>
                      {s.changeoverTime || 0}m
                    </text>
                    
                    <text x={width/2 + 6} y="34" className="text-[8px] font-bold fill-slate-400 uppercase">MTBF</text>
                    <text x={width - 6} y="34" textAnchor="end" className="text-[10px] font-mono font-bold fill-slate-700">
                      <title>MTBF: Mean Time Between Failures.</title>
                      {s.mtbf || 0}m
                    </text>
                    <text x="6" y="44" className="text-[8px] font-bold fill-slate-400 uppercase">MTTR</text>
                    <text x={width/2 - 6} y="44" textAnchor="end" className="text-[10px] font-mono font-bold fill-slate-700">
                      <title>MTTR: Mean Time To Repair.</title>
                      {s.mttr || 0}m
                    </text>

                    {/* Row 3 */}
                    <text x="6" y="54" className="text-[8px] font-bold fill-slate-400 uppercase">Batch</text>
                    <text x={width/2 - 6} y="54" textAnchor="end" className="text-[10px] font-mono font-bold fill-slate-700">
                      <title>Batch Size: The number of units processed together as a single group.</title>
                      {s.batchSize || 1}
                    </text>
                    
                    <text x={width/2 + 6} y="54" className="text-[8px] font-bold fill-slate-400 uppercase">Qual</text>
                    <text x={width - 6} y="54" textAnchor="end" className="text-[10px] font-mono font-bold fill-slate-700">
                      <title>Quality Rate: The percentage of units that pass quality inspection at this station.</title>
                      {s.qualityRate || 100}%
                    </text>
                  </g>
                )}

                {!isInventory ? (
                  <>
                    <text x="12" y="44" className="text-[10px] uppercase tracking-wider font-semibold fill-slate-400">Load / Flow</text>
                    <text x="12" y="62" className="text-lg font-mono font-bold fill-slate-700">
                      {(() => {
                        const learningFactor = (s.learningCurve || 100) / 100;
                        const setupPerUnit = (s.setupTime || 0) / (s.batchSize || 1);
                        const handlingTime = (s.materialHandlingTime || 0);
                        const fte = s.fte || 1;
                        const effectiveCT = isMachine 
                          ? (s.cycleTime / (s.batchSize || 1)) + setupPerUnit + handlingTime
                          : (s.cycleTime / (fte * learningFactor)) + setupPerUnit + handlingTime;
                        return (effectiveCT * (metrics.flowFactors?.[s.id] || 0)).toFixed(1);
                      })()}m
                    </text>
                    <div className="flex items-center gap-2">
                      <text x="12" y="72" className="text-[9px] font-mono fill-slate-400">
                        {((metrics.flowFactors?.[s.id] || 0) * 100).toFixed(0)}% flow
                      </text>
                      {settings.showHeatmap && metrics.systemTakt > 0 && (
                        <text x={width - 12} y="72" textAnchor="end" className="text-[9px] font-mono font-bold fill-slate-500">
                          {(() => {
                            const learningFactor = (s.learningCurve || 100) / 100;
                            const setupPerUnit = (s.setupTime || 0) / (s.batchSize || 1);
                            const handlingTime = (s.materialHandlingTime || 0);
                            const fte = s.fte || 1;
                            const effectiveCT = isMachine 
                              ? (s.cycleTime / (s.batchSize || 1)) + setupPerUnit + handlingTime
                              : (s.cycleTime / (fte * learningFactor)) + setupPerUnit + handlingTime;
                            const load = effectiveCT * (metrics.flowFactors?.[s.id] || 0);
                            return ((load / metrics.systemTakt) * 100).toFixed(0);
                          })()}% util
                        </text>
                      )}
                    </div>
                  </>
                ) : (
                  <g transform={`translate(0, 15)`}>
                    <text x={width/2} y="10" textAnchor="middle" className="text-sm font-mono font-bold fill-slate-700">
                      {s.targetInventory} / {s.capacity}
                    </text>
                    <text x={width/2} y="20" textAnchor="middle" className="text-[9px] font-mono fill-slate-400">
                      {((s.targetInventory || 0) / (s.capacity || 1) * 100).toFixed(0)}% full
                    </text>
                  </g>
                )}

                {connectSourceId === s.id && (
                  isInventory ? (
                    <path 
                      d={`M 0 0 L ${width} 0 L ${width/2} ${height} Z`}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                      className="animate-[pulse_2s_ease-in-out_infinite]"
                    />
                  ) : (
                    <rect 
                      width={width} 
                      height={height} 
                      rx="8"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                      className="animate-[spin_4s_linear_infinite]"
                    />
                  )
                )}
              </g>
            );
          })}
          </g>
          
        </svg>
      </div>

      {/* VSM Timelines at the bottom */}
      {settings.showVsmInfo && metrics.criticalPathStationIds.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 p-4 z-10 pointer-events-none shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="pointer-events-auto overflow-x-auto pb-2">
            
            {/* VSM Lead Time Timeline (Saw) */}
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Value Stream Timeline</h3>
            <div className="min-w-max px-2">
              <svg width={metrics.criticalPathStationIds.length * 120 + 200} height="100" className="overflow-visible">
                {(() => {
                  const cpStations = metrics.criticalPathStationIds.map(id => stations.find(s => s.id === id)!);
                  let currentX = 0;
                  const stepWidth = 120;
                  const points: string[] = [];
                  let currentY = 0;
                  
                  let totalVA = 0;
                  let totalNVA = 0;
                  
                  cpStations.forEach((s, i) => {
                    const isInv = s.type === 'inventory';
                    const flowFactor = metrics.flowFactors?.[s.id] || 0;
                    const systemTaktActual = metrics.systemTakt;
                    
                    const time = s.isKanbanSource ? 0 : (isInv 
                      ? (flowFactor > 0 ? (s.targetInventory || 0) * systemTaktActual / flowFactor : 0)
                      : (() => {
                          const learningFactor = (s.learningCurve || 100) / 100;
                          const setupPerUnit = (s.setupTime || 0) / (s.batchSize || 1);
                          const handlingTime = (s.materialHandlingTime || 0);
                          const fte = s.fte || 1;
                          return s.type === 'machine' 
                            ? (s.cycleTime / (s.batchSize || 1)) + setupPerUnit + handlingTime
                            : (s.cycleTime / (fte * learningFactor)) + setupPerUnit + handlingTime;
                        })());

                    if (!s.isKanbanSource) {
                      if (isInv) totalNVA += time;
                      else totalVA += time;
                    }

                    const targetY = (isInv || s.isKanbanSource) ? 20 : 70;
                    
                    if (i === 0) {
                      points.push(`M 0 ${targetY}`);
                      currentY = targetY;
                    } else if (currentY !== targetY) {
                      points.push(`L ${currentX} ${targetY}`);
                      currentY = targetY;
                    }
                    
                    points.push(`L ${currentX + stepWidth} ${targetY}`);
                    currentX += stepWidth;
                  });

                  // Format time helper
                  const formatTime = (mins: number) => {
                    if (mins >= 60 * 24) return `${(mins / (60 * 24)).toFixed(1)}d`;
                    if (mins >= 60) return `${(mins / 60).toFixed(1)}h`;
                    return `${mins.toFixed(1)}m`;
                  };

                  return (
                    <g>
                      {/* Grid lines */}
                      <line x1="0" y1="20" x2={currentX} y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                      <line x1="0" y1="70" x2={currentX} y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                      
                      {/* The Saw Line */}
                      <path d={points.join(' ')} fill="none" stroke="#64748b" strokeWidth="2" />
                      
                      {/* Labels */}
                      {cpStations.map((s, i) => {
                        const isInv = s.type === 'inventory';
                        const flowFactor = metrics.flowFactors?.[s.id] || 0;
                        const systemTaktActual = metrics.systemTakt;
                        
                        const time = isInv 
                          ? (flowFactor > 0 ? (s.targetInventory || 0) * systemTaktActual / flowFactor : 0)
                          : (s.type === 'machine' ? s.cycleTime / (s.batchSize || 1) : s.cycleTime / (s.fte || 1));
                        
                        const xCenter = i * stepWidth + (stepWidth / 2);

                        return (
                          <g key={`vsm-label-${s.id}`}>
                            <text x={xCenter} y={isInv ? 12 : 88} textAnchor="middle" className={`text-[11px] font-mono font-bold ${isInv ? 'fill-orange-600' : 'fill-blue-600'}`}>
                              {formatTime(time)}
                            </text>
                            <text x={xCenter} y={isInv ? 32 : 58} textAnchor="middle" className="text-[9px] font-bold fill-slate-400 uppercase tracking-tighter">
                              {s.name}
                            </text>
                          </g>
                        );
                      })}

                      {/* Summary Box at the end */}
                      <g transform={`translate(${currentX + 20}, 10)`}>
                        <rect width="140" height="70" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                        <text x="70" y="20" textAnchor="middle" className="text-[9px] font-bold text-slate-500 uppercase tracking-wider fill-slate-500">Total Lead Time</text>
                        <text x="70" y="36" textAnchor="middle" className="text-[14px] font-mono font-bold fill-slate-800">{formatTime(totalNVA + totalVA)}</text>
                        
                        <line x1="10" y1="44" x2="130" y2="44" stroke="#e2e8f0" strokeWidth="1" />
                        
                        <text x="15" y="58" className="text-[9px] font-bold fill-slate-500">VA: <tspan className="fill-blue-600">{formatTime(totalVA)}</tspan></text>
                        <text x="125" y="58" textAnchor="end" className="text-[9px] font-bold fill-slate-500">NVA: <tspan className="fill-orange-600">{formatTime(totalNVA)}</tspan></text>
                      </g>
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
