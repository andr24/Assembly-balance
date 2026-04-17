export interface Station {
  id: string;
  name: string;
  cycleTime: number; // minutes
  fte: number;
  maxFteAllowed?: number; // Physical constraint
  trainedFteAvailable?: number; // Skill constraint
  minFteRequired?: number; // Safety/Operational constraint
  x: number;
  y: number;
  type?: 'station' | 'inventory' | 'machine';
  capacity?: number;
  targetInventory?: number;
  idealInventory?: number; // Calculated
  changeoverTime?: number; // minutes
  mtbf?: number; // minutes
  mttr?: number; // minutes
  qualityRate?: number; // percentage 0-100
  batchSize?: number; // units
  flowMode?: 'additive' | 'assembly';
  isKanbanSource?: boolean;
  setupTime?: number; // minutes
  materialHandlingTime?: number; // minutes
  learningCurve?: number; // percentage 0-100 (100% = full speed)
}

export interface Group {
  id: string;
  name: string;
  stationIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  splitPercent: number;
  isRework: boolean;
  waypoints?: { x: number; y: number }[];
  transitTime?: number; // minutes to travel between stations
  inputGroup?: string; // For OR logic in assembly mode
}

export interface AssemblyLine {
  id: string;
  name: string;
  stations: Station[];
  connections: Connection[];
  groups?: Group[];
}

export interface Shift {
  id: string;
  name: string;
  startTime: string; // "HHhMM"
  endTime: string; // "HHhMM"
  lunchBreakStart?: string; // "HHhMM"
  lunchBreakEnd?: string; // "HHhMM"
  fte: number;
}

export interface Schedule {
  days: {
    shifts: Shift[];
  }[]; // 7 days
}

export interface GlobalSettings {
  demand: number; // units/day
  availableHours: number; // hrs/day
  schedule?: Schedule;
  showVsmInfo?: boolean;
  showHeatmap?: boolean;
  enableAI?: boolean;
  aiProvider?: 'gemini' | 'openai' | 'custom';
  aiModel?: string;
  aiApiKey?: string;
  aiEndpoint?: string; // For custom providers
  aiCustomPrompt?: string; // User defined context for AI analysis
}

export interface Metrics {
  taktTime: number;
  adjustedDemand: number;
  adjustedTakt: number;
  systemTakt: number;
  maxStationLoad: number;
  bottleneckStationId: string | null;
  lineOutput: number;
  leadTime: number;
  lineEfficiency: number;
  wip: number;
  totalFTE: number;
  flowFactors?: Record<string, number>;
  idealInventories?: Record<string, number>;
  criticalPathStationIds: string[];
  criticalPathConnectionIds: string[];
  vaTime: number;
  nvaTime: number;
  pce: number;
}

export type StationState = 'working' | 'starved' | 'blocked' | 'idle' | 'down' | 'off-shift';

export interface SimulationSnapshot {
  time: number; // minutes from start
  dayIndex: number;
  shiftIndex: number;
  shiftName: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  weekday: string;
  output: number;
  defects: number; // cumulative defects
  rework: number; // cumulative rework
  inventory: Record<string, number>;
  stationOutputs: Record<string, number>; // cumulative output per station
  wip: number;
  stationStates: Record<string, StationState>;
  staffingRatio?: number;
  missingParts?: Record<string, string[]>; // stationId -> list of source station names missing
  units: { id: string, stationId?: string, connectionId?: string, progress: number }[];
}

export interface ShiftMetric {
  dayIndex: number;
  shiftIndex: number;
  shiftName: string;
  weekday: string;
  output: number;
  defects: number;
  rework: number;
}

export interface SimulationResult {
  snapshots: SimulationSnapshot[];
  totalOutput: number;
  totalDefects: number;
  totalRework: number;
  finalInventory: Record<string, number>;
  stationUtilization: Record<string, number>; // percentage 0-100
  starvationTime: Record<string, number>; // percentage 0-100
  blockageTime: Record<string, number>; // percentage 0-100
  defectsByStation: Record<string, number>;
  reworkByStation: Record<string, number>;
  outputsByStation: Record<string, number>;
  shiftMetrics: ShiftMetric[];
}
