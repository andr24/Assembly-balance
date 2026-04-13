import { GlobalSettings } from '../types';

export const parseTime = (timeStr: string) => {
  const [h, m] = timeStr.split('h').map(Number);
  return h * 60 + m;
};

export const getEffectiveWorkingTime = (startTime: string, endTime: string, lunchBreakStart?: string, lunchBreakEnd?: string) => {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const lunchDuration = (lunchBreakStart && lunchBreakEnd) ? (parseTime(lunchBreakEnd) - parseTime(lunchBreakStart)) : 0;
  return (end - start) - lunchDuration;
};

export const getAvailableMinutes = (settings: GlobalSettings) => {
  const { availableHours, schedule } = settings;
  if (schedule && schedule.days.length > 0) {
    const firstDay = schedule.days[0];
    return firstDay.shifts.reduce((acc, shift) => {
      return acc + getEffectiveWorkingTime(shift.startTime, shift.endTime, shift.lunchBreakStart, shift.lunchBreakEnd);
    }, 0);
  }
  return availableHours * 60;
};
