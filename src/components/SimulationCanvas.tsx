import React, { useState, useRef, useEffect } from 'react';
import { Station, Connection, SimulationSnapshot } from '../types';
import { STATION_WIDTH, STATION_HEIGHT, INVENTORY_WIDTH, INVENTORY_HEIGHT } from '../constants';
import { cn } from '../lib/utils';
import { ZoomIn, ZoomOut, Maximize, User, Cpu, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SimulationCanvasProps {
  stations: Station[];
  connections: Connection[];
  snapshot: SimulationSnapshot | null;
  stationUtilization?: Record<string, number>;
  onStationMove?: (stationId: string, x: number, y: number) => void;
  onStationClick?: (stationId: string) => void;
  onConnectionClick?: (connectionId: string) => void;
  selectedStationId?: string | null;
  selectedConnectionId?: string | null;
}

export function SimulationCanvas({ 
  stations, 
  connections, 
  snapshot, 
  stationUtilization,
  onStationMove, 
  onStationClick,
  onConnectionClick,
  selectedStationId,
  selectedConnectionId
}: SimulationCanvasProps) {
  const [scale, setScale] = useState(0.8);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggedStation, setDraggedStation] = useState<{ id: string, startX: number, startY: number, mouseStartX: number, mouseStartY: number } | null>(null);
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.min(Math.max(prev * delta, 0.2), 3));
    } else {
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as SVGElement;
    const isBackground = target.tagName === 'svg' || target.id === 'grid-bg-sim';
    
    if (e.button === 1 || (e.button === 0 && (e.altKey || isBackground))) {
      setIsPanning(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (isPanning) {
      setOffset(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    } else if (draggedStation && onStationMove) {
      const dx = (e.clientX - draggedStation.mouseStartX) / scale;
      const dy = (e.clientY - draggedStation.mouseStartY) / scale;
      onStationMove(draggedStation.id, draggedStation.startX + dx, draggedStation.startY + dy);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedStation(null);
  };

  const handleStationMouseDown = (e: React.MouseEvent, s: Station) => {
    e.stopPropagation();
    setDraggedStation({
      id: s.id,
      startX: s.x,
      startY: s.y,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY
    });
  };

  const resetView = () => {
    setScale(0.8);
    setOffset({ x: 50, y: 50 });
  };

  const hoveredStation = stations.find(s => s.id === hoveredStationId);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-slate-50 relative overflow-hidden rounded-2xl border border-slate-200 shadow-inner cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setHoveredStationId(null);
      }}
    >
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        <button 
          onClick={() => setScale(prev => Math.min(prev * 1.2, 3))}
          className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button 
          onClick={() => setScale(prev => Math.max(prev * 0.8, 0.2))}
          className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button 
          onClick={resetView}
          className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600"
          title="Reset View"
        >
          <Maximize size={18} />
        </button>
      </div>

      {/* Tooltip Overlay */}
      {hoveredStation && (
        <div 
          className="fixed z-50 pointer-events-none bg-slate-900/90 backdrop-blur-sm text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs min-w-[160px]"
          style={{ 
            left: mousePos.x + 15, 
            top: mousePos.y + 15 
          }}
        >
          <div className="font-bold border-b border-slate-700 pb-1 mb-2 flex items-center justify-between">
            <span>{hoveredStation.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 capitalize">{hoveredStation.type || 'station'}</span>
          </div>
          <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={cn(
                    "font-bold capitalize",
                    (snapshot?.stationStates[hoveredStation.id] || 'idle') === 'working' ? 'text-blue-400' : 
                    ((snapshot?.stationStates[hoveredStation.id] || 'idle') === 'starved' ? 'text-red-400' : 
                     (snapshot?.stationStates[hoveredStation.id] === 'down' ? 'text-slate-400' : 'text-amber-400'))
                  )}>
                    {snapshot?.stationStates[hoveredStation.id] || 'idle'}
                  </span>
                </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Inventory:</span>
              <span className="font-mono font-bold">{Math.floor(snapshot?.inventory[hoveredStation.id] || 0)} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cycle Time:</span>
              <span className="font-mono">{hoveredStation.cycleTime} min</span>
            </div>
            {hoveredStation.type !== 'inventory' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Workers:</span>
                  <span className="font-mono">{hoveredStation.fte}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Quality:</span>
                  <span className="font-mono">{hoveredStation.qualityRate || 100}%</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <svg width="100%" height="100%" className="bg-slate-50">
        <defs>
          <marker id="arrowhead-sim" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 8 3 L 0 6 L 2 3 Z" fill="#94a3b8" />
          </marker>
          <marker id="arrowhead-rework-sim" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 8 3 L 0 6 L 2 3 Z" fill="#ef4444" />
          </marker>
        </defs>

        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
          <pattern id="grid-sim" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          </pattern>
          <rect id="grid-bg-sim" x="-10000" y="-10000" width="20000" height="20000" fill="url(#grid-sim)" />
          {/* Connections */}
          {connections.map(conn => {
            const source = stations.find(s => s.id === conn.sourceId);
            const target = stations.find(s => s.id === conn.targetId);
            if (!source || !target) return null;

            const isSelected = selectedConnectionId === conn.id;
            const sourceWidth = source.type === 'inventory' ? INVENTORY_WIDTH : STATION_WIDTH;
            const sourceHeight = source.type === 'inventory' ? INVENTORY_HEIGHT : STATION_HEIGHT;
            const targetWidth = target.type === 'inventory' ? INVENTORY_WIDTH : STATION_WIDTH;
            const targetHeight = target.type === 'inventory' ? INVENTORY_HEIGHT : STATION_HEIGHT;

            const startX = source.x + sourceWidth;
            const startY = source.y + sourceHeight / 2;
            const endX = target.x;
            const endY = target.y + targetHeight / 2;

            const dx = endX - startX;
            const cp1x = startX + Math.max(dx * 0.5, 50);
            const cp2x = endX - Math.max(dx * 0.5, 50);

            const pathData = `M ${startX} ${startY} C ${cp1x} ${startY} ${cp2x} ${endY} ${endX} ${endY}`;

            return (
              <g 
                key={conn.id} 
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnectionClick?.(conn.id);
                }}
              >
                {/* Hit area */}
                <path 
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="15"
                />
                <path 
                  d={pathData}
                  fill="none"
                  stroke={isSelected ? "#3b82f6" : (conn.isRework ? "#fca5a5" : "#cbd5e1")}
                  strokeWidth={isSelected ? "4" : "2"}
                  strokeDasharray={conn.isRework ? "5,5" : "none"}
                  markerEnd={conn.isRework ? "url(#arrowhead-rework-sim)" : "url(#arrowhead-sim)"}
                  className="transition-all duration-200"
                />
                
                {/* Split Percent Badge */}
                {!conn.isRework && (
                  <g transform={`translate(${startX + 30}, ${startY})`} className="pointer-events-none">
                    <rect x="-12" y="-8" width="24" height="16" rx="4" fill="white" stroke={isSelected ? "#3b82f6" : "#e2e8f0"} strokeWidth="1" />
                    <text textAnchor="middle" dy=".3em" className={cn("text-[8px] font-bold", isSelected ? "fill-blue-600" : "fill-slate-500")}>
                      {conn.splitPercent}%
                    </text>
                  </g>
                )}

                {/* Input Group Badge */}
                {conn.inputGroup && !conn.isRework && (
                  <g transform={`translate(${startX + dx * 0.7}, ${startY + (endY - startY) * 0.7})`} className="pointer-events-none">
                    <rect x="-20" y="-8" width="40" height="16" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                    <text textAnchor="middle" dy=".3em" className="text-[8px] font-bold fill-slate-600">
                      {conn.inputGroup}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Units */}
          {snapshot?.units.map(unit => {
            if (unit.connectionId) {
              const conn = connections.find(c => c.id === unit.connectionId);
              if (!conn) return null;
              const source = stations.find(s => s.id === conn.sourceId);
              const target = stations.find(s => s.id === conn.targetId);
              if (!source || !target) return null;

              const sourceWidth = source.type === 'inventory' ? INVENTORY_WIDTH : STATION_WIDTH;
              const sourceHeight = source.type === 'inventory' ? INVENTORY_HEIGHT : STATION_HEIGHT;
              const targetHeight = target.type === 'inventory' ? INVENTORY_HEIGHT : STATION_HEIGHT;

              const startX = source.x + sourceWidth;
              const startY = source.y + sourceHeight / 2;
              const endX = target.x;
              const endY = target.y + targetHeight / 2;

              const dx = endX - startX;
              const cp1x = startX + Math.max(dx * 0.5, 50);
              const cp2x = endX - Math.max(dx * 0.5, 50);

              // Cubic Bezier calculation
              const t = Math.min(1, Math.max(0, unit.progress));
              const x = Math.pow(1 - t, 3) * startX + 
                        3 * Math.pow(1 - t, 2) * t * cp1x + 
                        3 * (1 - t) * Math.pow(t, 2) * cp2x + 
                        Math.pow(t, 3) * endX;
              const y = Math.pow(1 - t, 3) * startY + 
                        3 * Math.pow(1 - t, 2) * t * startY + 
                        3 * (1 - t) * Math.pow(t, 2) * endY + 
                        Math.pow(t, 3) * endY;

              return (
                <motion.g 
                  key={unit.id} 
                  initial={false}
                  animate={{ x: 0, y: 0 }}
                  className="pointer-events-none"
                >
                  <motion.circle 
                    animate={{ cx: x, cy: y }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    r="4" 
                    fill="#3b82f6" 
                    className="shadow-sm" 
                  />
                  <motion.circle 
                    animate={{ cx: x, cy: y }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    r="6" 
                    fill="#3b82f6" 
                    fillOpacity="0.2" 
                  />
                </motion.g>
              );
            } else if (unit.stationId) {
              const s = stations.find(st => st.id === unit.stationId);
              if (!s || s.type === 'inventory') return null;
              
              const width = s.type === 'machine' ? STATION_WIDTH : STATION_WIDTH;
              const height = s.type === 'machine' ? STATION_HEIGHT : STATION_HEIGHT;
              
              // Show unit inside station, moving with progress
              const progressX = s.x + 10 + (unit.progress * (width - 20));
              const progressY = s.y + height / 2;

              return (
                <motion.g 
                  key={unit.id} 
                  initial={false}
                  className="pointer-events-none"
                >
                  <rect 
                    x={s.x + 5} 
                    y={s.y + height - 8} 
                    width={width - 10} 
                    height="3" 
                    rx="1.5" 
                    fill="#e2e8f0" 
                  />
                  <motion.rect 
                    animate={{ width: (width - 10) * unit.progress }}
                    x={s.x + 5} 
                    y={s.y + height - 8} 
                    height="3" 
                    rx="1.5" 
                    fill="#3b82f6" 
                  />
                  <motion.circle 
                    animate={{ cx: progressX, cy: progressY }}
                    r="3" 
                    fill="#3b82f6" 
                  />
                </motion.g>
              );
            }
            return null;
          })}

          {/* Stations */}
          {stations.map(s => {
            const isInventory = s.type === 'inventory';
            const width = isInventory ? INVENTORY_WIDTH : STATION_WIDTH;
            const height = isInventory ? INVENTORY_HEIGHT : STATION_HEIGHT;
            const isSelected = selectedStationId === s.id;
            
            const state = snapshot?.stationStates[s.id] || 'idle';
            const invCount = snapshot?.inventory[s.id] || 0;

            const getStatusColor = () => {
              if (isInventory) return isSelected ? 'fill-blue-50 stroke-blue-500' : 'fill-white stroke-slate-300';
              switch (state) {
                case 'working': return 'fill-blue-50 stroke-blue-500';
                case 'starved': return 'fill-red-50 stroke-red-500';
                case 'blocked': return 'fill-amber-50 stroke-amber-500';
                case 'down': return 'fill-slate-200 stroke-slate-600';
                default: return isSelected ? 'fill-blue-50 stroke-blue-500' : 'fill-white stroke-slate-300';
              }
            };

            const getUtilizationColor = (utilization: number) => {
              if (utilization < 20) return '#ef4444'; // red-500
              if (utilization < 50) return '#f59e0b'; // amber-500
              if (utilization < 80) return '#22c55e'; // green-500
              return '#3b82f6'; // blue-500
            };

            return (
              <g 
                key={s.id} 
                transform={`translate(${s.x}, ${s.y})`}
                onMouseDown={(e) => handleStationMouseDown(e, s)}
                onMouseEnter={() => setHoveredStationId(s.id)}
                onMouseLeave={() => setHoveredStationId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onStationClick?.(s.id);
                }}
                className="cursor-move"
              >
                {/* Heatmap Overlay */}
                {stationUtilization && !isInventory && (
                  <rect 
                    width={width} 
                    height={height} 
                    rx={s.type === 'machine' ? "4" : "8"}
                    fill={getUtilizationColor(stationUtilization[s.id] || 0)}
                    fillOpacity="0.2"
                    className="pointer-events-none"
                  />
                )}
                
                {isInventory ? (
                  <path 
                    d={`M 0 0 L ${width} 0 L ${width/2} ${height} Z`}
                    className={cn("transition-colors duration-300", getStatusColor())}
                    strokeWidth={isSelected ? "3" : "2"}
                  />
                ) : (
                  <rect 
                    width={width} 
                    height={height} 
                    rx={s.type === 'machine' ? "4" : "8"}
                    className={cn("transition-colors duration-300", getStatusColor())}
                    strokeWidth={isSelected ? "4" : "3"}
                  />
                )}

                {/* Status Indicator Glow */}
                {!isInventory && state !== 'idle' && (
                  <rect 
                    width={width + 8} 
                    height={height + 8} 
                    x="-4" y="-4"
                    rx={s.type === 'machine' ? "8" : "12"}
                    fill="none"
                    stroke={state === 'working' ? '#3b82f6' : (state === 'starved' ? '#ef4444' : (state === 'down' ? '#475569' : '#f59e0b'))}
                    strokeWidth="2"
                    strokeOpacity="0.3"
                    className={state === 'down' ? "" : "animate-pulse"}
                  />
                )}

                <text x={isInventory ? width/2 : 10} y={isInventory ? height + 15 : 20} textAnchor={isInventory ? "middle" : "start"} className="text-[10px] font-bold fill-slate-700 pointer-events-none">{s.name}</text>
                
                {/* Type Icon */}
                <g transform={`translate(${isInventory ? width/2 - 10 : width - 30}, ${isInventory ? 6 : 10})`} className="opacity-40 pointer-events-none fill-slate-500">
                  {s.type === 'inventory' ? <Package size={20} /> : (s.type === 'machine' ? <Cpu size={20} /> : <User size={20} />)}
                </g>

                {/* Inventory Badge */}
                <g transform={`translate(${width/2}, ${height/2})`} className="pointer-events-none">
                  <circle r="12" fill="white" stroke="#e2e8f0" strokeWidth="1" />
                  <text textAnchor="middle" dy=".3em" className="text-[10px] font-mono font-bold fill-slate-900">
                    {Math.floor(invCount)}
                  </text>
                </g>

                {/* Output Badge */}
                <g transform={`translate(${width}, ${height})`} className="pointer-events-none">
                  <rect x="-35" y="-12" width="35" height="12" rx="4" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />
                  <text x="-17.5" y="-3" textAnchor="middle" className="text-[8px] font-mono font-bold fill-blue-600">
                    {snapshot?.stationOutputs?.[s.id] || 0}
                  </text>
                </g>

                {/* Status Label */}
                {!isInventory && (
                  <g>
                    <text 
                      x={width/2} 
                      y={-5} 
                      textAnchor="middle" 
                      className={cn(
                        "text-[8px] font-black uppercase tracking-widest pointer-events-none",
                        state === 'working' ? 'fill-blue-600' : (state === 'starved' ? 'fill-red-600' : (state === 'down' ? 'fill-slate-600' : 'fill-amber-600'))
                      )}
                    >
                      {state}
                    </text>
                    {state === 'starved' && snapshot?.missingParts?.[s.id] && (
                      <text x={width/2} y={-15} textAnchor="middle" className="text-[7px] fill-red-500 font-bold pointer-events-none">
                        MISSING: {snapshot.missingParts[s.id].join(', ')}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
