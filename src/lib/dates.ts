/** Date handling for a single-timezone Israeli app.
 *
 *  Rule: every stored calendar date is UTC midnight of the intended day.
 *  Storing local midnight would serialise to 21:00/22:00 of the *previous* day
 *  in UTC, and every "is this today?" check would be off by one for half the
 *  year. Reading and writing both go through the helpers here.
 */

export const APP_TZ = 'Asia/Jerusalem';

const ISO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** UTC midnight of the given Y/M/D. Month is 1-based. */
export function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** UTC midnight of "today" as experienced in Israel, not on the server. */
export function today(now: Date = new Date()): Date {
  // en-CA renders as YYYY-MM-DD, which parses back cleanly as a UTC instant.
  return new Date(`${ISO_DAY.format(now)}T00:00:00.000Z`);
}

/** Collapses any timestamp to the UTC midnight of its Israeli calendar day. */
export function toDayStart(value: Date): Date {
  return new Date(`${ISO_DAY.format(value)}T00:00:00.000Z`);
}

/** Minutes that `tz` is ahead of UTC at the given instant. */
function offsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asIfUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  // Drop sub-second noise so the difference is a clean offset.
  return (asIfUTC - Math.floor(at.getTime() / 1000) * 1000) / 60_000;
}

/**
 * The real instant at which an Israeli calendar day began.
 *
 * Calendar dates are stored as UTC midnight, which is a *label*, not a moment:
 * 2026-08-13T00:00:00Z is three hours after the Israeli day actually started.
 * Comparing a genuine timestamp such as `completedAt` against that label
 * silently loses everything done between local midnight and 03:00.
 */
export function dayStartInstant(day: Date): Date {
  let guess = new Date(day.getTime());
  // Two passes settle the case where the offset changes across the boundary.
  for (let i = 0; i < 2; i++) {
    guess = new Date(day.getTime() - offsetMinutes(guess, APP_TZ) * 60_000);
  }
  return guess;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Whole days from `a` to `b`. Negative means `b` is in the past. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((toDayStart(b).getTime() - toDayStart(a).getTime()) / 86_400_000);
}

export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return false;
  return toDayStart(a).getTime() === toDayStart(b).getTime();
}

/** The Israeli week runs Sunday → Saturday. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getUTCDay());
}

export const WEEKDAY_NAMES = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי',
  'שבת',
] as const;

export const WEEKDAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const;

export function weekdayName(date: Date): string {
  return WEEKDAY_NAMES[date.getUTCDay()];
}

/** DD.MM — the Israeli short form. Always rendered inside a `.num` span so the
 *  digits stay an LTR island inside surrounding Hebrew. */
export function formatShortDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}`;
}

/** DD.MM.YYYY */
export function formatFullDate(date: Date): string {
  return `${formatShortDate(date)}.${date.getUTCFullYear()}`;
}

/**
 * How a date reads to a person standing on `base`:
 * "היום", "מחר", "מחרתיים", "אתמול", a weekday inside the coming week,
 * otherwise the numeric date.
 */
export function relativeDayLabel(date: Date, base: Date = today()): string {
  const diff = Math.round((toDayStart(date).getTime() - base.getTime()) / 86_400_000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === 2) return 'מחרתיים';
  if (diff === -1) return 'אתמול';
  if (diff < -1) return formatShortDate(date);
  if (diff <= 6) return weekdayName(date);
  return formatShortDate(date);
}

/** "14:30" — 24-hour, the only clock Israeli UIs use. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isOverdue(date: Date | null | undefined, base: Date = today()): boolean {
  if (!date) return false;
  return toDayStart(date).getTime() < base.getTime();
}
