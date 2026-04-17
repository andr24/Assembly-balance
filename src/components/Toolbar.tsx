import React, { useState } from 'react';
import { Plus, Trash2, Settings2, Download, Upload, BarChart3, LayoutDashboard, Zap, Info, ChevronDown, FileJson, FileSpreadsheet, Pencil, Check, X, Activity, Sparkles } from 'lucide-react';
import { GlobalSettings, AssemblyLine, Station } from '../types';
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
  selectedIds: string[];
  selectedConnId: string | null;
  isConnecting: boolean;
  setIsConnecting: (b: boolean) => void;
  onOpenBalancer: () => void;
  onOpenSimulator: () => void;
  stations: Station[];
  addGroup: (stationIds: string[]) => void;
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
  selectedIds,
  selectedConnId,
  isConnecting,
  setIsConnecting,
  onOpenBalancer,
  onOpenSimulator,
  stations,
  addGroup
}: ToolbarProps) {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState('');

  return (
    <header className="min-h-[64px] bg-white border-b border-slate-200 flex flex-wrap items-center justify-between px-4 lg:px-6 z-50 shadow-sm relative gap-4 py-2 lg:py-0">
      <div className="flex flex-wrap items-center gap-4 lg:gap-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200 shrink-0">
            <BarChart3 className="text-white" size={20} />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">LineBalancer <span className="text-blue-600 font-black italic">PRO</span></h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Assembly Optimization Engine</p>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200 hidden md:block" />

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenBalancer}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 lg:px-4 py-2 rounded-lg text-sm font-bold transition-all border border-blue-200"
            title="Global Balancer"
          >
            <BarChart3 size={18} />
            <span className="hidden lg:inline">Global Balancer</span>
          </button>

          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-2 bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 lg:px-4 py-2 rounded-lg text-sm font-bold transition-all border border-purple-200"
            title="Simulator"
          >
            <Activity size={18} />
            <span className="hidden lg:inline">Simulator</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
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
          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
          <button 
            onClick={onAddLine}
            className="bg-white text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium transition-all border border-slate-200 shadow-sm flex items-center gap-1"
            title="Add New Line"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="h-8 w-px bg-slate-200 hidden md:block" />

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1">
              <label className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Demand</label>
              <InfoTooltip content="Target number of units to produce per day." position="bottom" />
            </div>
            <input 
              type="number" 
              value={settings.demand}
              onChange={e => setSettings({ ...settings, demand: Number(e.target.value) })}
              className="w-14 sm:w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1">
              <label className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">H / Day</label>
              <InfoTooltip content="Net available production time per day (excluding breaks)." position="bottom" />
            </div>
            <input 
              type="number" 
              value={settings.availableHours}
              onChange={e => setSettings({ ...settings, availableHours: Number(e.target.value) })}
              className="w-14 sm:w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
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
              <button 
                onClick={() => setSettings({ ...settings, showHeatmap: !settings.showHeatmap })}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold ${settings.showHeatmap ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Utilization Heatmap
                <Activity size={16} fill={settings.showHeatmap ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={() => setSettings({ ...settings, enableAI: !settings.enableAI })}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold ${settings.enableAI ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                AI Insights
                <Zap size={16} fill={settings.enableAI ? "currentColor" : "none"} />
              </button>

              {settings.enableAI && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Provider</label>
                    <select 
                      value={settings.aiProvider || ''}
                      onChange={e => setSettings({ ...settings, aiProvider: e.target.value as any })}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" disabled>Select Provider...</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="custom">Custom (OpenAI Compatible)</option>
                    </select>
                  </div>

                  {settings.aiProvider && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model</label>
                      <input 
                        type="text"
                        value={settings.aiModel || ''}
                        onChange={e => setSettings({ ...settings, aiModel: e.target.value })}
                        placeholder={settings.aiProvider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o'}
                        className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">API Key</label>
                    <input 
                      type="password"
                      value={settings.aiApiKey || ''}
                      onChange={e => setSettings({ ...settings, aiApiKey: e.target.value })}
                      placeholder="Enter API Key..."
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {settings.aiProvider === 'custom' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Endpoint URL</label>
                      <input 
                        type="text"
                        value={settings.aiEndpoint || ''}
                        onChange={e => setSettings({ ...settings, aiEndpoint: e.target.value })}
                        placeholder="https://api.example.com/v1"
                        className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Analysis Persona / Context</label>
                    <textarea 
                      value={settings.aiCustomPrompt || ''}
                      onChange={e => setSettings({ ...settings, aiCustomPrompt: e.target.value })}
                      placeholder="e.g. Focus on lean manufacturing and waste reduction..."
                      className="w-full h-20 bg-white border border-slate-200 rounded-md px-2 py-1 text-[10px] font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              )}
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
              <div className="h-px bg-slate-100 my-1" />
              <button 
                onClick={() => {
                  const data = {
                    line: lines.find(l => l.id === activeLineId),
                    settings,
                    timestamp: new Date().toISOString(),
                    context: "Assembly Line Configuration for AI Analysis"
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ai-export-${activeLineId}.json`;
                  a.click();
                  setShowDataMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-50"
              >
                <Sparkles size={16} />
                Export for AI
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
