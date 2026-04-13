import React from 'react';
import { Schedule, Shift } from '../types';
import { X, Plus, Trash2, Info } from 'lucide-react';

// Simple tooltip component
const Tooltip = ({ content }: { content: string }) => (
  <div className="group relative inline-block ml-1">
    <Info size={14} className="text-slate-400 cursor-help" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] p-2 rounded whitespace-nowrap z-50">
      {content}
    </div>
  </div>
);

interface ScheduleConfigProps {
  schedule: Schedule;
  setSchedule: (s: Schedule) => void;
  onClose: () => void;
}

export function ScheduleConfig({ schedule, setSchedule, onClose }: ScheduleConfigProps) {
  const updateShift = (dayIndex: number, shiftIndex: number, updates: Partial<Shift>) => {
    const newSchedule = JSON.parse(JSON.stringify(schedule));
    newSchedule.days[dayIndex].shifts[shiftIndex] = { ...newSchedule.days[dayIndex].shifts[shiftIndex], ...updates };
    setSchedule(newSchedule);
  };

  const addShift = (dayIndex: number) => {
    const newSchedule = JSON.parse(JSON.stringify(schedule));
    newSchedule.days[dayIndex].shifts.push({
      id: `shift${Date.now()}`,
      name: 'New Shift',
      startTime: '08h00',
      endTime: '16h40',
      fte: 1
    });
    setSchedule(newSchedule);
  };

  const deleteShift = (dayIndex: number, shiftIndex: number) => {
    const newSchedule = JSON.parse(JSON.stringify(schedule));
    newSchedule.days[dayIndex].shifts.splice(shiftIndex, 1);
    setSchedule(newSchedule);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-[700px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Schedule Configuration</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-4">
          {schedule.days.map((day, dayIndex) => (
            <div key={dayIndex} className="border p-4 rounded-lg">
              <h3 className="font-bold mb-2">Day {dayIndex + 1}</h3>
              <div className="flex gap-2 mb-2 text-[10px] font-bold text-slate-400 uppercase">
                <div className="w-32">Name <Tooltip content="Shift identifier" /></div>
                <div className="w-20">Start <Tooltip content="Format: HHhMM (e.g., 08h00)" /></div>
                <div className="w-20">End <Tooltip content="Format: HHhMM (e.g., 16h40)" /></div>
                <div className="w-20">Lunch Start <Tooltip content="Format: HHhMM" /></div>
                <div className="w-20">Lunch End <Tooltip content="Format: HHhMM" /></div>
                <div className="w-16">FTE <Tooltip content="Full-Time Equivalent workers" /></div>
              </div>
              {day.shifts.map((shift, shiftIndex) => (
                <div key={shift.id} className="flex items-center gap-2 mb-2">
                  <input type="text" value={shift.name} onChange={e => updateShift(dayIndex, shiftIndex, { name: e.target.value })} className="border p-1 rounded w-32" />
                  <input type="text" value={shift.startTime} onChange={e => updateShift(dayIndex, shiftIndex, { startTime: e.target.value })} className="border p-1 rounded w-20" />
                  <input type="text" value={shift.endTime} onChange={e => updateShift(dayIndex, shiftIndex, { endTime: e.target.value })} className="border p-1 rounded w-20" />
                  <input type="text" value={shift.lunchBreakStart || ''} onChange={e => updateShift(dayIndex, shiftIndex, { lunchBreakStart: e.target.value })} className="border p-1 rounded w-20" />
                  <input type="text" value={shift.lunchBreakEnd || ''} onChange={e => updateShift(dayIndex, shiftIndex, { lunchBreakEnd: e.target.value })} className="border p-1 rounded w-20" />
                  <input type="number" value={shift.fte} onChange={e => updateShift(dayIndex, shiftIndex, { fte: parseInt(e.target.value) })} className="border p-1 rounded w-16" />
                  <button onClick={() => deleteShift(dayIndex, shiftIndex)} className="text-red-500"><Trash2 size={16} /></button>
                </div>
              ))}
              <button onClick={() => addShift(dayIndex)} className="text-blue-600 flex items-center gap-1 text-sm"><Plus size={16} /> Add Shift</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
