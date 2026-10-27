/**
 * Habit tables: which days a table shows, and how it pages.
 *
 * Everything works on UTC-midnight dates (see lib/dates.ts). A table's period
 * is the window it shows at once; its weekdays decide which days in that
 * window get a column. A monthly table limited to Sunday–Thursday shows only
 * the working days of the month, in order.
 */

import { addDays, dateOnly, startOfWeek } from './dates';
import { monthName } from './calendar';

export const TRACKER_PERIODS = ['WEEK', 'MONTH', 'QUARTER', 'YEAR'] as const;
export type TrackerPeriod = (typeof TRACKER_PERIODS)[number];

export const PERIOD_LABELS: Record<TrackerPeriod, string> = {
  WEEK: 'שבועית',
  MONTH: 'חודשית',
  QUARTER: 'רבעונית',
  YEAR: 'שנתית',
};

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const WORK_WEEK = [0, 1, 2, 3, 4] as const;

export function isTrackerPeriod(value: string): value is TrackerPeriod {
  return (TRACKER_PERIODS as readonly string[]).includes(value);
}

/** "0,1,2" ⇄ [0, 1, 2]. Sorted, unique, and never empty: a table with no
 *  days would have no columns to check. */
export function parseWeekdays(value: string): number[] {
  const days = [...new Set(value.split(',').filter((part) => part.trim() !== '').map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  return days.length ? days : [...ALL_WEEKDAYS];
}

export function serializeWeekdays(days: readonly number[]): string {
  return parseWeekdays(days.join(',')).join(',');
}

/** First and last day (inclusive) of the period containing `anchor`. */
export function periodRange(period: TrackerPeriod, anchor: Date): { start: Date; end: Date } {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  switch (period) {
    case 'WEEK': {
      const start = startOfWeek(anchor);
      return { start, end: addDays(start, 6) };
    }
    case 'MONTH':
      return { start: dateOnly(y, m + 1, 1), end: addDays(dateOnly(y, m + 2, 1), -1) };
    case 'QUARTER': {
      const q = Math.floor(m / 3);
      return { start: dateOnly(y, q * 3 + 1, 1), end: addDays(dateOnly(y, q * 3 + 4, 1), -1) };
    }
    case 'YEAR':
      return { start: dateOnly(y, 1, 1), end: dateOnly(y, 12, 31) };
  }
}

/** The days that get a column, in calendar order. */
export function trackerDays(period: TrackerPeriod, anchor: Date, weekdays: readonly number[]): Date[] {
  const { start, end } = periodRange(period, anchor);
  const allowed = new Set(weekdays);
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (allowed.has(day.getUTCDay())) days.push(day);
  }
  return days;
}

/** The same position one period earlier (-1) or later (+1). */
export function shiftPeriod(period: TrackerPeriod, anchor: Date, direction: number): Date {
  const { start } = periodRange(period, anchor);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  switch (period) {
    case 'WEEK':
      return addDays(start, 7 * direction);
    case 'MONTH':
      return dateOnly(y, m + 1 + direction, 1);
    case 'QUARTER':
      return dateOnly(y, m + 1 + 3 * direction, 1);
    case 'YEAR':
      return dateOnly(y + direction, 1, 1);
  }
}

/** How the period reads in the table header. */
export function periodLabel(period: TrackerPeriod, anchor: Date): string {
  const { start, end } = periodRange(period, anchor);
  switch (period) {
    case 'WEEK': {
      const sameMonth = start.getUTCMonth() === end.getUTCMonth();
      return sameMonth
        ? `${start.getUTCDate()}–${end.getUTCDate()} ב${monthName(end.getUTCMonth())}`
        : `${start.getUTCDate()} ב${monthName(start.getUTCMonth())} – ${end.getUTCDate()} ב${monthName(end.getUTCMonth())}`;
    }
    case 'MONTH':
      return `${monthName(start.getUTCMonth())} ${start.getUTCFullYear()}`;
    case 'QUARTER':
      return `רבעון ${Math.floor(start.getUTCMonth() / 3) + 1} · ${start.getUTCFullYear()}`;
    case 'YEAR':
      return String(start.getUTCFullYear());
  }
}

/** "2026-10-27" — the key a check is stored and looked up under. */
export function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

export function parseDayKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const day = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(day.getTime()) || dayKey(day) !== value ? null : day;
}
