export interface Station {
  id: string;
  name: string;
  cycleTime: number; // minutes
  workers: number;
  maxWorkersAllowed?: number; // Physical constraint
  isAutoBalanced?: boolean;
  x: number;
  y: number;
  type?: 'station' | 'inventory';
  capacity?: number;
  targetInventory?: number;
  idealInventory?: number; // Calculated
  changeoverTime?: number; // minutes
  uptime?: number; // percentage 0-100
  qualityRate?: number; // percentage 0-100
  batchSize?: number; // units
  flowMode?: 'additive' | 'assembly';
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  splitPercent: number;
  isRework: boolean;
  waypoints?: { x: number; y: number }[];
}

export interface AssemblyLine {
  id: string;
  name: string;
  stations: Station[];
  connections: Connection[];
}

export interface GlobalSettings {
  demand: number; // units/day
  availableHours: number; // hrs/day
  autoBalanceAll?: boolean;
  showVsmInfo?: boolean;
  totalWorkersPool?: number; // Resource constraint
  useConstrainedBalance?: boolean;
}

export interface Metrics {
  taktTime: number;
  adjustedDemand: number;
  adjustedTakt: number;
  bottleneckStationId: string | null;
  lineOutput: number;
  leadTime: number;
  lineEfficiency: number;
  wip: number;
  totalWorkers: number;
  flowFactors?: Record<string, number>;
  finalWorkers?: Record<string, number>;
  idealInventories?: Record<string, number>;
  criticalPathStationIds: string[];
  criticalPathConnectionIds: string[];
  vaTime: number;
  nvaTime: number;
  pce: number;
}
