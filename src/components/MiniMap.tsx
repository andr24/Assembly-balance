import React from 'react';
import { Station, Connection } from '../types';
import { cn } from '../lib/utils';
import { STATION_WIDTH, STATION_HEIGHT, INVENTORY_WIDTH, INVENTORY_HEIGHT } from '../constants';

interface MiniMapProps {
  stations: Station[];
  connections: Connection[];
  pan: { x: number; y: number };
  zoom: number;
  containerWidth: number;
  containerHeight: number;
  onPan: (x: number, y: number) => void;
}

export function MiniMap({ stations, connections, pan, zoom, containerWidth, containerHeight, onPan }: MiniMapProps) {
  if (stations.length === 0) return null;

  const minX = Math.min(...stations.map(s => s.x)) - 50;
  const maxX = Math.max(...stations.map(s => s.x + (s.type === 'inventory' ? INVENTORY_WIDTH : STATION_WIDTH))) + 50;
  const minY = Math.min(...stations.map(s => s.y)) - 50;
  const maxY = Math.max(...stations.map(s => s.y + (s.type === 'inventory' ? INVENTORY_HEIGHT : STATION_HEIGHT))) + 50;

  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(150 / width, 100 / height);

  const handleMiniMapClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale + minX;
    const y = (e.clientY - rect.top) / minY; // Simplified for now
    // This needs proper coordinate mapping based on zoom/pan
  };

  return (
    <div className="absolute bottom-6 right-6 w-40 h-28 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
      <svg width="100%" height="100%" viewBox={`${minX} ${minY} ${width} ${height}`}>
        {connections.map(c => {
          const s = stations.find(st => st.id === c.sourceId);
          const t = stations.find(st => st.id === c.targetId);
          if (!s || !t) return null;
          return <line key={c.id} x1={s.x + STATION_WIDTH/2} y1={s.y + STATION_HEIGHT/2} x2={t.x + STATION_WIDTH/2} y2={t.y + STATION_HEIGHT/2} stroke="#cbd5e1" strokeWidth="2" />;
        })}
        {stations.map(s => (
          <rect 
            key={s.id} 
            x={s.x} 
            y={s.y} 
            width={s.type === 'inventory' ? INVENTORY_WIDTH : STATION_WIDTH} 
            height={s.type === 'inventory' ? INVENTORY_HEIGHT : STATION_HEIGHT} 
            fill={s.type === 'inventory' ? "#bfdbfe" : "#94a3b8"} 
          />
        ))}
      </svg>
    </div>
  );
}
