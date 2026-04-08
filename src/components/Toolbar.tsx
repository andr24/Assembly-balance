import React, { useState } from 'react';
import { Plus, Trash2, Settings2, Download, Upload, BarChart3, LayoutDashboard, Zap, Info, ChevronDown, FileJson, FileSpreadsheet, Pencil, Check, X, Activity } from 'lucide-react';
import { GlobalSettings, AssemblyLine } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface ToolbarProps {
  lines: AssemblyLine[];
  activeLineId: string;
  setActiveLineId: (id: string) => void;
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  onAddLine: () => void;
  onRenameLine: (id: string, name: string) => void;
  onDeleteLine: (id: string) => void;
  onAddStation: (type: 'station' | 'inventory' | 'machine') => void;
  onDelete: () => void;
  onExport: () => void;
  onExportExcel: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedId: string | null;
  selectedConnId: string | null;
  isConnecting: boolean;
  setIsConnecting: (b: boolean) => void;
  onOpenBalancer: () => void;
  onOpenSimulator: () => void;
}

export function Toolbar({
  lines,
  activeLineId,
  setActiveLineId,
  settings,
  setSettings,
  onAddLine,
  onRenameLine,
  onDeleteLine,
  onAddStation,
  onDelete,
  onExport,
  onExportExcel,
  onImport,
  selectedId,
  selectedConnId,
  isConnecting,
  setIsConnecting,
  onOpenBalancer,
  onOpenSimulator
}: ToolbarProps) {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState('');

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-50 shadow-sm relative">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <BarChart3 className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">LineBalancer <span className="text-blue-600 font-black italic">PRO</span></h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Assembly Optimization Engine</p>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        <button
          onClick={onOpenBalancer}
          className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-bold transition-all border border-blue-200"
        >
          <BarChart3 size={18} />
          Global Balancer
        </button>

        <button
          onClick={onOpenSimulator}
          className="flex items-center gap-2 bg-purple-50 text-purple-700 hover:bg-purple-100 px-4 py-2 rounded-lg text-sm font-bold transition-all border border-purple-200"
        >
          <Activity size={18} />
          Simulator
        </button>

        <div className="flex items-center gap-3">
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input 
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="bg-white border border-blue-500 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 w-40"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onRenameLine(activeLineId, editName);
                    setIsRenaming(false);
                  } else if (e.key === 'Escape') {
                    setIsRenaming(false);
                  }
                }}
              />
              <button 
                onClick={() => {
                  onRenameLine(activeLineId, editName);
                  setIsRenaming(false);
                }}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Save"
              >
                <Check size={16} />
              </button>
              <button 
                onClick={() => setIsRenaming(false)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <select 
                value={activeLineId}
                onChange={e => setActiveLineId(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
              >
                {lines.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  setEditName(lines.find(l => l.id === activeLineId)?.name || '');
                  setIsRenaming(true);
                }}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Rename Line"
              >
                <Pencil size={16} />
              </button>
              <button 
                onClick={() => onDeleteLine(activeLineId)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Line"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <button 
            onClick={onAddLine}
            className="bg-white text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium transition-all border border-slate-200 shadow-sm flex items-center gap-1"
            title="Add New Line"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Demand (u/d)</label>
              <InfoTooltip content="Target number of units to produce per day." position="bottom" />
            </div>
            <input 
              type="number" 
              value={settings.demand}
              onChange={e => setSettings({ ...settings, demand: Number(e.target.value) })}
              className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Hours/Day</label>
              <InfoTooltip content="Net available production time per day (excluding breaks)." position="bottom" />
            </div>
            <input 
              type="number" 
              value={settings.availableHours}
              onChange={e => setSettings({ ...settings, availableHours: Number(e.target.value) })}
              className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Settings Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg text-sm font-bold text-slate-700 border border-slate-200 hover:bg-slate-200 transition-all"
          >
            <Settings2 size={18} />
            Settings
            <ChevronDown size={16} />
          </button>
          {showSettingsMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1">
              <button 
                onClick={() => setSettings({ ...settings, showVsmInfo: !settings.showVsmInfo })}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold ${settings.showVsmInfo ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                VSM Info
                <LayoutDashboard size={16} fill={settings.showVsmInfo ? "currentColor" : "none"} />
              </button>
            </div>
          )}
        </div>

        {/* Data Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowDataMenu(!showDataMenu)}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg text-sm font-bold text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 transition-all"
          >
            <FileJson size={18} />
            Data
            <ChevronDown size={16} />
          </button>
          {showDataMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1">
              <label className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                <Upload size={16} />
                Import JSON
                <input type="file" className="hidden" accept=".json" onChange={(e) => { onImport(e); setShowDataMenu(false); }} />
              </label>
              <button 
                onClick={() => { onExportExcel(); setShowDataMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                <FileSpreadsheet size={16} />
                Export Excel
              </button>
              <button 
                onClick={() => { onExport(); setShowDataMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                <FileJson size={16} />
                Export JSON
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
