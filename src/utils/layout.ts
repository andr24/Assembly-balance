import { Station, Connection } from '../types';
import { STATION_WIDTH, STATION_HEIGHT, INVENTORY_WIDTH, INVENTORY_HEIGHT } from '../constants';

export function autoLayout(stations: Station[], connections: Connection[]): Station[] {
  if (stations.length === 0) return stations;

  // Simple layer-based layout
  const layers: Station[][] = [];
  const visited = new Set<string>();

  // Find start nodes (no incoming connections)
  let currentLayer = stations.filter(s => !connections.some(c => c.targetId === s.id && !c.isRework));
  
  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    const nextLayer: Station[] = [];
    currentLayer.forEach(s => {
      visited.add(s.id);
      connections.filter(c => c.sourceId === s.id && !c.isRework).forEach(c => {
        const target = stations.find(st => st.id === c.targetId);
        if (target && !visited.has(target.id) && !nextLayer.includes(target)) {
          nextLayer.push(target);
        }
      });
    });
    currentLayer = nextLayer;
  }

  // Position stations
  const newStations = [...stations];
  const layerWidth = 250;
  const layerHeight = 150;

  layers.forEach((layer, layerIdx) => {
    layer.forEach((s, sIdx) => {
      const station = newStations.find(st => st.id === s.id);
      if (station) {
        station.x = layerIdx * layerWidth + 100;
        station.y = sIdx * layerHeight + 100;
      }
    });
  });

  return newStations;
}
