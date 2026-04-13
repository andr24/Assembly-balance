import React, { useState } from 'react';
import { Sparkles, Loader2, Download, Copy, Check } from 'lucide-react';
import { analyzeLinePerformance } from '../../services/aiService';
import { AssemblyLine, GlobalSettings, SimulationResult } from '../../types';
import Markdown from 'react-markdown';

interface AIInsightsProps {
  line: AssemblyLine;
  settings: GlobalSettings;
  result: SimulationResult;
}

export function AIInsights({ line, settings, result }: AIInsightsProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const feedback = await analyzeLinePerformance(line, settings, result);
      setAnalysis(feedback);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    const data = {
      line,
      settings,
      result: {
        totalOutput: result.totalOutput,
        totalDefects: result.totalDefects,
        totalRework: result.totalRework,
        stationUtilization: result.stationUtilization,
        starvationTime: result.starvationTime,
        blockageTime: result.blockageTime,
      },
      analysis
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-analysis-${line.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
  };

  const handleCopy = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Optimization Insights</h3>
            <p className="text-[10px] text-slate-500 font-medium">Powered by Gemini AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analysis && (
            <>
              <button 
                onClick={handleCopy}
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
              <button 
                onClick={handleExport}
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                title="Export for external analysis"
              >
                <Download size={16} />
              </button>
            </>
          )}
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {analysis ? 'Refresh Analysis' : 'Generate Analysis'}
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {analysis ? (
          <div className="prose prose-slate prose-sm max-w-none prose-headings:text-slate-800 prose-headings:font-bold prose-p:text-slate-600 prose-strong:text-slate-900">
            <Markdown>{analysis}</Markdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
              <Sparkles size={32} className="text-blue-400 opacity-50" />
            </div>
            <div className="max-w-xs">
              <h4 className="text-sm font-bold text-slate-700">No analysis generated yet</h4>
              <p className="text-xs text-slate-500 mt-1">Click the button above to have Gemini analyze your line performance and provide optimization tips.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
