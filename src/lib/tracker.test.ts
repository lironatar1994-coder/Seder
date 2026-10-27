import { describe, expect, it } from 'vitest';
import { dateOnly } from './dates';
import { dayKey, parseDayKey, parseWeekdays, periodLabel, periodRange, serializeWeekdays, shiftPeriod, trackerDays } from './tracker';

const tue = dateOnly(2026, 10, 27);

describe('tracker periods', () => {
  it('runs weeks Sunday to Saturday', () => {
    const { start, end } = periodRange('WEEK', tue);
    expect(dayKey(start)).toBe('2026-10-25');
    expect(dayKey(end)).toBe('2026-10-31');
  });

  it('bounds months, quarters and years', () => {
    expect(periodRange('MONTH', tue)).toEqual({ start: dateOnly(2026, 10, 1), end: dateOnly(2026, 10, 31) });
    expect(periodRange('QUARTER', tue)).toEqual({ start: dateOnly(2026, 10, 1), end: dateOnly(2026, 12, 31) });
    expect(periodRange('QUARTER', dateOnly(2026, 2, 28))).toEqual({ start: dateOnly(2026, 1, 1), end: dateOnly(2026, 3, 31) });
    expect(periodRange('YEAR', tue)).toEqual({ start: dateOnly(2026, 1, 1), end: dateOnly(2026, 12, 31) });
  });

  it('keeps only the chosen weekdays, in order', () => {
    const work = trackerDays('WEEK', tue, [0, 1, 2, 3, 4]);
    expect(work.map(dayKey)).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']);
    const fridays = trackerDays('MONTH', tue, [5]);
    expect(fridays.map(dayKey)).toEqual(['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30']);
    expect(trackerDays('YEAR', tue, [0, 1, 2, 3, 4, 5, 6])).toHaveLength(365);
  });

  it('pages across month and year boundaries', () => {
    expect(dayKey(shiftPeriod('WEEK', tue, 1))).toBe('2026-11-01');
    expect(dayKey(shiftPeriod('MONTH', dateOnly(2026, 12, 15), 1))).toBe('2027-01-01');
    expect(dayKey(shiftPeriod('QUARTER', dateOnly(2026, 2, 1), -1))).toBe('2025-10-01');
    expect(dayKey(shiftPeriod('YEAR', tue, -1))).toBe('2025-01-01');
  });

  it('labels each period in Hebrew', () => {
    expect(periodLabel('WEEK', tue)).toBe('25–31 באוקטובר');
    expect(periodLabel('WEEK', dateOnly(2026, 11, 1))).toBe('1–7 בנובמבר');
    expect(periodLabel('WEEK', dateOnly(2026, 9, 30))).toBe('27 בספטמבר – 3 באוקטובר');
    expect(periodLabel('MONTH', tue)).toBe('אוקטובר 2026');
    expect(periodLabel('QUARTER', tue)).toBe('רבעון 4 · 2026');
    expect(periodLabel('YEAR', tue)).toBe('2026');
  });
});

describe('tracker weekdays and keys', () => {
  it('normalises weekday lists and never returns none', () => {
    expect(parseWeekdays('4,0,0,9,2')).toEqual([0, 2, 4]);
    expect(parseWeekdays('')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(serializeWeekdays([3, 1])).toBe('1,3');
  });

  it('round-trips day keys and rejects impossible dates', () => {
    expect(parseDayKey('2026-10-27')).toEqual(tue);
    expect(parseDayKey('2026-02-30')).toBeNull();
    expect(parseDayKey('27/10/2026')).toBeNull();
  });
});
