/** The Hebrew calendar half of the date lockup.
 *
 *  Israelis read both calendars daily — the Gregorian date to schedule by and
 *  the Hebrew date for everything cultural — so the header carries both.
 *
 *  ICU supplies the calendar conversion and the month name (including the
 *  Adar א׳/ב׳ split in leap years); the numerals come from `gematria.ts`,
 *  because ICU's `nu-hebr` resolves back to Latin digits and would print
 *  "29 באב" where a reader expects "כ״ט באב".
 *
 *  If a runtime ships without Hebrew calendar data, every helper returns an
 *  empty string and the lockup falls back to Gregorian only rather than
 *  throwing.
 */

import { weekdayName } from './dates';
import { toGematria, toHebrewYear } from './gematria';

let cached: Intl.DateTimeFormat | null | undefined;

function formatter(): Intl.DateTimeFormat | null {
  if (cached !== undefined) return cached;
  try {
    const fmt = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    cached = fmt.resolvedOptions().calendar === 'hebrew' ? fmt : null;
  } catch {
    cached = null;
  }
  return cached;
}

interface HebrewParts {
  day: string;
  month: string;
  year: string;
  /** The literal between day and month — "‎ ב" for most months. */
  separator: string;
}

function parts(date: Date): HebrewParts | null {
  const fmt = formatter();
  if (!fmt) return null;

  const raw = fmt.formatToParts(date);
  const day = raw.find((p) => p.type === 'day')?.value;
  const month = raw.find((p) => p.type === 'month')?.value;
  const year = raw.find((p) => p.type === 'year')?.value;
  if (!day || !month || !year) return null;

  // The literal directly after the day carries the "ב" prefix ("29 באב").
  const dayIndex = raw.findIndex((p) => p.type === 'day');
  const separator = raw[dayIndex + 1]?.type === 'literal' ? raw[dayIndex + 1].value : ' ';

  return {
    day: toGematria(Number(day)),
    month,
    year: toHebrewYear(Number(year)),
    separator,
  };
}

/** "כ״ט באב" — day and month, no year. Empty if unavailable. */
export function hebrewDayMonth(date: Date): string {
  const p = parts(date);
  return p ? `${p.day}${p.separator}${p.month}` : '';
}

/** Just the day, in gematria: "כ״ט". Used in calendar cells. */
export function hebrewDay(date: Date): string {
  return parts(date)?.day ?? '';
}

/** "אב" · "אדר ב׳" — the month name alone, leap months included. */
export function hebrewMonth(date: Date): string {
  return parts(date)?.month ?? '';
}

/** The numeric Hebrew day, 1–30, or null. Rosh Chodesh is 1 (and 30 of a full
 *  month, which is the first of its two days). */
export function hebrewDayNumber(date: Date): number | null {
  const fmt = formatter();
  if (!fmt) return null;
  const raw = fmt.formatToParts(date).find((p) => p.type === 'day')?.value;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** "ה׳תשפ״ו" */
export function hebrewYear(date: Date): string {
  return parts(date)?.year ?? '';
}

/** "כ״ט באב ה׳תשפ״ו" */
export function hebrewFull(date: Date): string {
  const p = parts(date);
  return p ? `${p.day}${p.separator}${p.month} ${p.year}` : '';
}

export interface DateLockup {
  /** "יום רביעי" */
  weekday: string;
  /** "כ״ט באב" — empty if the runtime lacks Hebrew calendar data. */
  hebrew: string;
  /** "כ״ט באב ה׳תשפ״ו" — the accessible long form. */
  hebrewFull: string;
  /** "12.08" */
  gregorian: string;
  /** "12.08.2026" */
  gregorianFull: string;
}

export function buildLockup(date: Date): DateLockup {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return {
    weekday: weekdayName(date),
    hebrew: hebrewDayMonth(date),
    hebrewFull: hebrewFull(date),
    gregorian: `${d}.${m}`,
    gregorianFull: `${d}.${m}.${date.getUTCFullYear()}`,
  };
}
