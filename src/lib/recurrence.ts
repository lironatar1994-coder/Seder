/** Repeating tasks.
 *
 *  A deliberately small rule set rather than RRULE: four shapes cover what
 *  people actually type into a to-do app, and each one can be read back in
 *  Hebrew without a translation table. Rules serialise to a short string so the
 *  whole feature costs one nullable column.
 *
 *    daily:2            every second day
 *    weekly:1:1,4       every week on Monday and Thursday
 *    monthly:1:15       the 15th of every month
 *    yearly:1:8:13      13 August, every year
 *
 *  Weekdays are 0–6, Sunday first, matching `Date.getUTCDay()` and the Israeli
 *  week. Everything here is pure and UTC-midnight based, like the rest of the
 *  date handling.
 */

import { addDays, WEEKDAY_NAMES } from './dates';

export type Recurrence =
  | { kind: 'daily'; interval: number }
  | { kind: 'weekly'; interval: number; weekdays: number[] }
  | { kind: 'monthly'; interval: number; day: number }
  | { kind: 'yearly'; interval: number; month: number; day: number };

const MAX_INTERVAL = 366;

function clampInterval(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_INTERVAL);
}

export function serializeRecurrence(rule: Recurrence): string {
  switch (rule.kind) {
    case 'daily':
      return `daily:${rule.interval}`;
    case 'weekly':
      return `weekly:${rule.interval}:${[...new Set(rule.weekdays)].sort((a, b) => a - b).join(',')}`;
    case 'monthly':
      return `monthly:${rule.interval}:${rule.day}`;
    case 'yearly':
      return `yearly:${rule.interval}:${rule.month}:${rule.day}`;
  }
}

/** Returns null for anything malformed, so a bad value in the database
 *  degrades to "not repeating" instead of throwing on every render. */
export function parseRecurrence(value: string | null | undefined): Recurrence | null {
  if (!value) return null;
  const [kind, rawInterval, ...rest] = value.split(':');
  const interval = clampInterval(Number(rawInterval));

  switch (kind) {
    case 'daily':
      return Number.isFinite(Number(rawInterval)) ? { kind: 'daily', interval } : null;

    case 'weekly': {
      const weekdays = (rest[0] ?? '')
        .split(',')
        // Empty segments must be dropped *before* Number(), because Number('')
        // is 0 — an absent list would otherwise become "Sunday".
        .filter((part) => part.trim() !== '')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
      // An empty weekday set means "the same weekday as the current date",
      // resolved at computation time.
      return { kind: 'weekly', interval, weekdays: [...new Set(weekdays)].sort((a, b) => a - b) };
    }

    case 'monthly': {
      const day = Number(rest[0]);
      if (!Number.isInteger(day) || day < 1 || day > 31) return null;
      return { kind: 'monthly', interval, day };
    }

    case 'yearly': {
      const month = Number(rest[0]);
      const day = Number(rest[1]);
      if (!Number.isInteger(month) || month < 1 || month > 12) return null;
      if (!Number.isInteger(day) || day < 1 || day > 31) return null;
      return { kind: 'yearly', interval, month, day };
    }

    default:
      return null;
  }
}

/** Last day of the given month, so month-end rules do not skip. */
function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** UTC midnight, with the day clamped into the month — "the 31st of every
 *  month" lands on the 28th/30th where there is no 31st, rather than rolling
 *  into the next month. */
function clampedDate(year: number, monthIndex: number, day: number): Date {
  const max = lastDayOfMonth(year, monthIndex);
  return new Date(Date.UTC(year, monthIndex, Math.min(day, max)));
}

/**
 * The first occurrence strictly after `from`.
 *
 * `from` is the occurrence just completed (or today, for a task that had no
 * date). Always strictly after, so completing a task can never leave it sitting
 * on the same day.
 */
export function nextOccurrence(rule: Recurrence, from: Date): Date {
  switch (rule.kind) {
    case 'daily':
      return addDays(from, rule.interval);

    case 'weekly': {
      // With no explicit weekdays, repeat on the weekday `from` falls on.
      const days = rule.weekdays.length ? rule.weekdays : [from.getUTCDay()];

      // Another day later in the same week?
      const next = days.find((d) => d > from.getUTCDay());
      if (next !== undefined) return addDays(from, next - from.getUTCDay());

      // Otherwise the first listed day, `interval` weeks ahead. The week starts
      // on Sunday, so stepping back to Sunday first keeps the arithmetic simple.
      const sunday = addDays(from, -from.getUTCDay());
      return addDays(sunday, rule.interval * 7 + days[0]);
    }

    case 'monthly': {
      let year = from.getUTCFullYear();
      let month = from.getUTCMonth() + rule.interval;
      year += Math.floor(month / 12);
      month = ((month % 12) + 12) % 12;

      const candidate = clampedDate(year, month, rule.day);
      // A clamped day can land on or before `from` when intervals are short;
      // step one more month rather than return the past.
      if (candidate.getTime() <= from.getTime()) {
        const bumped = month + rule.interval;
        return clampedDate(year + Math.floor(bumped / 12), ((bumped % 12) + 12) % 12, rule.day);
      }
      return candidate;
    }

    case 'yearly': {
      const candidate = clampedDate(from.getUTCFullYear(), rule.month - 1, rule.day);
      if (candidate.getTime() > from.getTime()) return candidate;
      return clampedDate(from.getUTCFullYear() + rule.interval, rule.month - 1, rule.day);
    }
  }
}

/**
 * The first occurrence on or after `from` — where a new repeating task starts.
 *
 * Distinct from `nextOccurrence`, which is strictly after: "כל יום שני" typed
 * on a Monday should begin today, not skip a week.
 */
export function firstOccurrenceOnOrAfter(rule: Recurrence, from: Date): Date {
  switch (rule.kind) {
    case 'daily':
      return from;

    case 'weekly': {
      if (!rule.weekdays.length) return from;
      const today = from.getUTCDay();
      if (rule.weekdays.includes(today)) return from;
      const ahead = rule.weekdays.find((d) => d > today);
      return ahead !== undefined
        ? addDays(from, ahead - today)
        : addDays(from, 7 - today + rule.weekdays[0]);
    }

    case 'monthly': {
      const thisMonth = clampedDate(from.getUTCFullYear(), from.getUTCMonth(), rule.day);
      if (thisMonth.getTime() >= from.getTime()) return thisMonth;
      return nextOccurrence(rule, from);
    }

    case 'yearly': {
      const thisYear = clampedDate(from.getUTCFullYear(), rule.month - 1, rule.day);
      if (thisYear.getTime() >= from.getTime()) return thisYear;
      return clampedDate(from.getUTCFullYear() + 1, rule.month - 1, rule.day);
    }
  }
}

const HEBREW_ORDINAL_INTERVAL: Record<number, { day: string; week: string; month: string }> = {
  2: { day: 'יומיים', week: 'שבועיים', month: 'חודשיים' },
};

/** How the rule reads in Hebrew: "כל יום שני", "כל שבועיים", "כל 3 ימים". */
export function describeRecurrence(rule: Recurrence): string {
  switch (rule.kind) {
    case 'daily':
      if (rule.interval === 1) return 'כל יום';
      if (rule.interval === 2) return `כל ${HEBREW_ORDINAL_INTERVAL[2].day}`;
      return `כל ${rule.interval} ימים`;

    case 'weekly': {
      const names = rule.weekdays.map((d) => WEEKDAY_NAMES[d].replace('יום ', ''));
      const cadence =
        rule.interval === 1
          ? 'כל'
          : rule.interval === 2
            ? `כל ${HEBREW_ORDINAL_INTERVAL[2].week} ב`
            : `כל ${rule.interval} שבועות ב`;

      if (!names.length) return rule.interval === 1 ? 'כל שבוע' : `${cadence}שבוע`.trim();
      const list =
        names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} ו${names.at(-1)}`;
      return rule.interval === 1 ? `כל ${list}` : `${cadence}${list}`;
    }

    case 'monthly':
      if (rule.interval === 1) return `כל חודש ב-${rule.day}`;
      if (rule.interval === 2) return `כל ${HEBREW_ORDINAL_INTERVAL[2].month} ב-${rule.day}`;
      return `כל ${rule.interval} חודשים ב-${rule.day}`;

    case 'yearly':
      return rule.interval === 1
        ? `כל שנה ב-${rule.day}.${rule.month}`
        : `כל ${rule.interval} שנים ב-${rule.day}.${rule.month}`;
  }
}

/** Convenience for the UI: describe a stored string, or null. */
export function describeStored(value: string | null | undefined): string | null {
  const rule = parseRecurrence(value);
  return rule ? describeRecurrence(rule) : null;
}

/** The presets offered in the detail panel, resolved against a reference day so
 *  "weekly" means "weekly on that day". */
export function recurrencePresets(reference: Date): { label: string; value: string }[] {
  const weekday = reference.getUTCDay();
  return [
    { label: 'כל יום', value: serializeRecurrence({ kind: 'daily', interval: 1 }) },
    {
      label: 'כל יום עבודה',
      // Sunday–Thursday is the Israeli working week.
      value: serializeRecurrence({ kind: 'weekly', interval: 1, weekdays: [0, 1, 2, 3, 4] }),
    },
    {
      label: `כל ${WEEKDAY_NAMES[weekday].replace('יום ', '')}`,
      value: serializeRecurrence({ kind: 'weekly', interval: 1, weekdays: [weekday] }),
    },
    {
      label: 'כל שבועיים',
      value: serializeRecurrence({ kind: 'weekly', interval: 2, weekdays: [weekday] }),
    },
    {
      label: `כל חודש ב-${reference.getUTCDate()}`,
      value: serializeRecurrence({ kind: 'monthly', interval: 1, day: reference.getUTCDate() }),
    },
    {
      label: `כל שנה ב-${reference.getUTCDate()}.${reference.getUTCMonth() + 1}`,
      value: serializeRecurrence({
        kind: 'yearly',
        interval: 1,
        month: reference.getUTCMonth() + 1,
        day: reference.getUTCDate(),
      }),
    },
  ];
}
