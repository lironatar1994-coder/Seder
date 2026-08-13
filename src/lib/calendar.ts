/** Calendar grid construction.
 *
 *  Pure, timezone-safe and Israeli by default: the week runs Sunday → Saturday
 *  and the weekend is Friday–Saturday, not Saturday–Sunday. Every day carries
 *  both calendars, because that is the whole point of this app's header.
 *
 *  The grid is built in logical order (Sunday first). Direction is a rendering
 *  concern — a `dir="rtl"` CSS grid puts the first column on the right by
 *  itself, so nothing here reverses anything.
 */

import { addDays, isSameDay, startOfWeek, toDayStart, weekdayName, WEEKDAY_SHORT } from './dates';
import { hebrewDay, hebrewMonth, hebrewDayNumber, hebrewYear } from './hebrew-date';
import { toGematria } from './gematria';

export interface CalendarDay {
  /** UTC midnight of the day. */
  date: Date;
  /** "YYYY-MM-DD" — the key used everywhere else. */
  iso: string;
  dayOfMonth: number;
  /** False for the leading/trailing days that pad the grid. */
  inMonth: boolean;
  isToday: boolean;
  /** Friday or Saturday. */
  isWeekend: boolean;
  isShabbat: boolean;
  /** Gematria day, e.g. "כ״ט". */
  hebrewDay: string;
  /** Set only on Rosh Chodesh, so the month name appears once per month in the
   *  grid instead of repeating in all thirty cells. */
  hebrewMonthLabel: string | null;
  weekdayLong: string;
}

export interface CalendarWeek {
  key: string;
  days: CalendarDay[];
}

/** Fixed height: always six rows, so navigating months never jolts the layout. */
const WEEKS_IN_GRID = 6;

export const WEEKDAY_HEADERS = WEEKDAY_SHORT;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseISODay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function buildDay(date: Date, monthIndex: number, today: Date): CalendarDay {
  const weekday = date.getUTCDay();
  const hDayNumber = hebrewDayNumber(date);

  return {
    date,
    iso: iso(date),
    dayOfMonth: date.getUTCDate(),
    inMonth: date.getUTCMonth() === monthIndex,
    isToday: isSameDay(date, today),
    // The Israeli weekend.
    isWeekend: weekday === 5 || weekday === 6,
    isShabbat: weekday === 6,
    hebrewDay: hebrewDay(date),
    hebrewMonthLabel: hDayNumber === 1 ? hebrewMonth(date) : null,
    weekdayLong: weekdayName(date),
  };
}

export interface MonthGrid {
  /** UTC midnight of the first of the month. */
  anchor: Date;
  weeks: CalendarWeek[];
  /** All days, flat — handy for range queries. */
  days: CalendarDay[];
  first: Date;
  last: Date;
  /** "אוגוסט" */
  gregorianMonth: string;
  gregorianYear: number;
  /** "אב–אלול ה׳תשפ״ו" — a Gregorian month usually straddles two Hebrew ones. */
  hebrewRange: string;
  prevAnchor: string;
  nextAnchor: string;
}

const MONTH_NAMES = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const;

export function monthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex];
}

/** First of the month `offset` months from `anchor`, as "YYYY-MM". */
export function shiftMonth(anchor: Date, offset: number): string {
  const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Parses "YYYY-MM" into the first of that month; falls back to `fallback`. */
export function parseMonthAnchor(value: string | undefined, fallback: Date): Date {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
  }
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function buildMonthGrid(anchor: Date, today: Date): MonthGrid {
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const monthIndex = first.getUTCMonth();
  const gridStart = startOfWeek(first);

  const weeks: CalendarWeek[] = [];
  const days: CalendarDay[] = [];

  for (let w = 0; w < WEEKS_IN_GRID; w++) {
    const weekDays: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = buildDay(addDays(gridStart, w * 7 + d), monthIndex, today);
      weekDays.push(day);
      days.push(day);
    }
    weeks.push({ key: weekDays[0].iso, days: weekDays });
  }

  const last = new Date(Date.UTC(first.getUTCFullYear(), monthIndex + 1, 0));

  // The Hebrew months the Gregorian month overlaps. Almost always two.
  const startMonth = hebrewMonth(first);
  const endMonth = hebrewMonth(last);
  const year = hebrewYear(last);
  const hebrewRange = [startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`, year]
    .filter(Boolean)
    .join(' ');

  return {
    anchor: first,
    weeks,
    days,
    first,
    last,
    gregorianMonth: MONTH_NAMES[monthIndex],
    gregorianYear: first.getUTCFullYear(),
    hebrewRange,
    prevAnchor: shiftMonth(first, -1),
    nextAnchor: shiftMonth(first, 1),
  };
}

export interface WeekGrid {
  days: CalendarDay[];
  first: Date;
  last: Date;
  /** "10–16 באוגוסט" or "31 באוגוסט – 6 בספטמבר" when it straddles months. */
  label: string;
  hebrewRange: string;
  prevAnchor: string;
  nextAnchor: string;
}

/** "YYYY-MM-DD" of the Sunday `offset` weeks from the week containing `date`. */
export function shiftWeek(date: Date, offset: number): string {
  return iso(addDays(startOfWeek(toDayStart(date)), offset * 7));
}

export function buildWeekGrid(anchor: Date, today: Date): WeekGrid {
  const start = startOfWeek(toDayStart(anchor));
  const monthIndex = anchor.getUTCMonth();
  const days = Array.from({ length: 7 }, (_, i) => buildDay(addDays(start, i), monthIndex, today));
  const last = days[6].date;

  const label =
    start.getUTCMonth() === last.getUTCMonth()
      ? `${start.getUTCDate()}–${last.getUTCDate()} ב${MONTH_NAMES[start.getUTCMonth()]}`
      : `${start.getUTCDate()} ב${MONTH_NAMES[start.getUTCMonth()]} – ${last.getUTCDate()} ב${MONTH_NAMES[last.getUTCMonth()]}`;

  const startMonth = hebrewMonth(start);
  const endMonth = hebrewMonth(last);
  const hebrewRange = [
    startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`,
    hebrewYear(last),
  ]
    .filter(Boolean)
    .join(' ');

  return {
    days,
    first: start,
    last,
    label,
    hebrewRange,
    prevAnchor: shiftWeek(start, -1),
    nextAnchor: shiftWeek(start, 1),
  };
}

/** Ordinal week of the Hebrew month, used nowhere yet but keeps gematria
 *  helpers colocated for the mini-picker. */
export function gematria(n: number): string {
  return toGematria(n);
}
