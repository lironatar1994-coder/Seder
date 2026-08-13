import { describe, expect, it } from 'vitest';
import {
  describeRecurrence,
  describeStored,
  nextOccurrence,
  parseRecurrence,
  recurrencePresets,
  serializeRecurrence,
  type Recurrence,
} from './recurrence';

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Thursday 13 August 2026. */
const THU = day(2026, 8, 13);

describe('serialise / parse', () => {
  const cases: [Recurrence, string][] = [
    [{ kind: 'daily', interval: 3 }, 'daily:3'],
    [{ kind: 'weekly', interval: 1, weekdays: [0, 3] }, 'weekly:1:0,3'],
    [{ kind: 'monthly', interval: 2, day: 15 }, 'monthly:2:15'],
    [{ kind: 'yearly', interval: 1, month: 8, day: 13 }, 'yearly:1:8:13'],
  ];

  it.each(cases)('round-trips %j', (rule, text) => {
    expect(serializeRecurrence(rule)).toBe(text);
    expect(parseRecurrence(text)).toEqual(rule);
  });

  it('sorts and dedupes weekdays', () => {
    expect(serializeRecurrence({ kind: 'weekly', interval: 1, weekdays: [4, 1, 4] })).toBe(
      'weekly:1:1,4',
    );
  });

  it.each([null, undefined, '', 'nonsense', 'monthly:1:99', 'yearly:1:13:1', 'weekly'])(
    'treats %s as not repeating rather than throwing',
    (value) => {
      const parsed = parseRecurrence(value as string | null | undefined);
      // "weekly" alone is a valid degenerate rule; the rest are rejected.
      if (value === 'weekly') expect(parsed).toEqual({ kind: 'weekly', interval: 1, weekdays: [] });
      else expect(parsed).toBeNull();
    },
  );

  it('clamps a silly interval instead of trusting it', () => {
    expect(parseRecurrence('daily:0')).toEqual({ kind: 'daily', interval: 1 });
    expect(parseRecurrence('daily:99999')).toEqual({ kind: 'daily', interval: 366 });
  });
});

describe('nextOccurrence — daily', () => {
  it('steps by the interval', () => {
    expect(iso(nextOccurrence({ kind: 'daily', interval: 1 }, THU))).toBe('2026-08-14');
    expect(iso(nextOccurrence({ kind: 'daily', interval: 3 }, THU))).toBe('2026-08-16');
  });
});

describe('nextOccurrence — weekly', () => {
  it('finds a later day in the same week', () => {
    // Thursday (4) → Saturday (6) is still this week.
    const rule: Recurrence = { kind: 'weekly', interval: 1, weekdays: [0, 6] };
    expect(iso(nextOccurrence(rule, THU))).toBe('2026-08-15');
  });

  it('wraps to the first listed day next week', () => {
    // Thursday with only Sunday listed → the coming Sunday.
    const rule: Recurrence = { kind: 'weekly', interval: 1, weekdays: [0] };
    expect(iso(nextOccurrence(rule, THU))).toBe('2026-08-16');
  });

  it('honours a multi-week interval when it wraps', () => {
    const rule: Recurrence = { kind: 'weekly', interval: 2, weekdays: [4] };
    // Thursday → skip a week → Thursday 27 August.
    expect(iso(nextOccurrence(rule, THU))).toBe('2026-08-27');
  });

  it('with no weekdays, repeats on the same weekday', () => {
    const rule: Recurrence = { kind: 'weekly', interval: 1, weekdays: [] };
    expect(iso(nextOccurrence(rule, THU))).toBe('2026-08-20');
  });

  it('walks a working-week rule one day at a time', () => {
    const rule: Recurrence = { kind: 'weekly', interval: 1, weekdays: [0, 1, 2, 3, 4] };
    // Thursday is the last working day, so the next is Sunday.
    expect(iso(nextOccurrence(rule, THU))).toBe('2026-08-16');
    // …and Sunday's next is Monday.
    expect(iso(nextOccurrence(rule, day(2026, 8, 16)))).toBe('2026-08-17');
  });

  it('never returns the day it was given', () => {
    const rule: Recurrence = { kind: 'weekly', interval: 1, weekdays: [4] };
    expect(nextOccurrence(rule, THU).getTime()).toBeGreaterThan(THU.getTime());
  });
});

describe('nextOccurrence — monthly', () => {
  it('keeps the same day next month', () => {
    const rule: Recurrence = { kind: 'monthly', interval: 1, day: 13 };
    expect(iso(nextOccurrence(rule, THU))).toBe('2026-09-13');
  });

  it('clamps into short months instead of overflowing', () => {
    const rule: Recurrence = { kind: 'monthly', interval: 1, day: 31 };
    // 31 January + 1 month is the last day of February, not 3 March.
    expect(iso(nextOccurrence(rule, day(2026, 1, 31)))).toBe('2026-02-28');
    // …and the rule survives: from there it returns to the 31st.
    expect(iso(nextOccurrence(rule, day(2026, 2, 28)))).toBe('2026-03-31');
  });

  it('crosses the year boundary', () => {
    const rule: Recurrence = { kind: 'monthly', interval: 2, day: 5 };
    expect(iso(nextOccurrence(rule, day(2026, 12, 5)))).toBe('2027-02-05');
  });
});

describe('nextOccurrence — yearly', () => {
  it('moves to next year when the date has passed', () => {
    const rule: Recurrence = { kind: 'yearly', interval: 1, month: 8, day: 13 };
    expect(iso(nextOccurrence(rule, THU))).toBe('2027-08-13');
  });

  it('stays in this year when the date is still ahead', () => {
    const rule: Recurrence = { kind: 'yearly', interval: 1, month: 12, day: 1 };
    expect(iso(nextOccurrence(rule, THU))).toBe('2026-12-01');
  });

  it('clamps 29 February in a common year', () => {
    const rule: Recurrence = { kind: 'yearly', interval: 1, month: 2, day: 29 };
    expect(iso(nextOccurrence(rule, day(2026, 3, 1)))).toBe('2027-02-28');
  });
});

describe('describeRecurrence', () => {
  it.each<[Recurrence, string]>([
    [{ kind: 'daily', interval: 1 }, 'כל יום'],
    [{ kind: 'daily', interval: 2 }, 'כל יומיים'],
    [{ kind: 'daily', interval: 5 }, 'כל 5 ימים'],
    [{ kind: 'weekly', interval: 1, weekdays: [1] }, 'כל שני'],
    [{ kind: 'weekly', interval: 1, weekdays: [1, 4] }, 'כל שני וחמישי'],
    [{ kind: 'weekly', interval: 1, weekdays: [0, 2, 4] }, 'כל ראשון, שלישי וחמישי'],
    [{ kind: 'weekly', interval: 1, weekdays: [] }, 'כל שבוע'],
    [{ kind: 'weekly', interval: 2, weekdays: [3] }, 'כל שבועיים ברביעי'],
    [{ kind: 'monthly', interval: 1, day: 15 }, 'כל חודש ב-15'],
    [{ kind: 'monthly', interval: 3, day: 1 }, 'כל 3 חודשים ב-1'],
    [{ kind: 'yearly', interval: 1, month: 8, day: 13 }, 'כל שנה ב-13.8'],
  ])('%j reads as %s', (rule, expected) => {
    expect(describeRecurrence(rule)).toBe(expected);
  });

  it('describes a stored string, or nothing', () => {
    expect(describeStored('weekly:1:6')).toBe('כל שבת');
    expect(describeStored(null)).toBeNull();
    expect(describeStored('rubbish')).toBeNull();
  });
});

describe('presets', () => {
  const presets = recurrencePresets(THU);

  it('offers the Israeli working week, Sunday to Thursday', () => {
    const working = presets.find((p) => p.label === 'כל יום עבודה')!;
    expect(working.value).toBe('weekly:1:0,1,2,3,4');
  });

  it('anchors the weekly and monthly presets to the reference day', () => {
    expect(presets.find((p) => p.label === 'כל חמישי')?.value).toBe('weekly:1:4');
    expect(presets.find((p) => p.label === 'כל חודש ב-13')?.value).toBe('monthly:1:13');
  });

  it('produces only values that parse back', () => {
    presets.forEach((p) => expect(parseRecurrence(p.value)).not.toBeNull());
  });
});
