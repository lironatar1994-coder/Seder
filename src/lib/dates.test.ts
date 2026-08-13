import { describe, expect, it } from 'vitest';
import { dayStartInstant, relativeDayLabel, startOfWeek, today, toDayStart } from './dates';

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('dayStartInstant', () => {
  it('resolves the real moment an Israeli summer day began (UTC+3)', () => {
    // 13 August 2026 starts at 21:00 UTC on the 12th, during IDT.
    expect(dayStartInstant(day(2026, 8, 13)).toISOString()).toBe('2026-08-12T21:00:00.000Z');
  });

  it('resolves a winter day too (UTC+2)', () => {
    expect(dayStartInstant(day(2026, 1, 15)).toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });

  it('is always earlier than the UTC-midnight label it is derived from', () => {
    for (const d of [day(2026, 3, 27), day(2026, 10, 25), day(2026, 6, 1)]) {
      expect(dayStartInstant(d).getTime()).toBeLessThan(d.getTime());
    }
  });

  it('lands a task completed just after local midnight inside the day', () => {
    // 00:30 in Israel on 13 August is 21:30 UTC on the 12th.
    const completedAt = new Date('2026-08-12T21:30:00.000Z');
    expect(completedAt.getTime()).toBeGreaterThanOrEqual(
      dayStartInstant(day(2026, 8, 13)).getTime(),
    );
    // …and would have been wrongly excluded by the naive UTC-midnight compare.
    expect(completedAt.getTime()).toBeLessThan(day(2026, 8, 13).getTime());
  });
});

describe('today', () => {
  it('uses the Israeli calendar day, not the server clock', () => {
    // 22:30 UTC on 12 August is already the 13th in Israel.
    expect(today(new Date('2026-08-12T22:30:00.000Z')).toISOString()).toBe(
      '2026-08-13T00:00:00.000Z',
    );
  });

  it('is still the 12th an hour earlier', () => {
    expect(today(new Date('2026-08-12T20:30:00.000Z')).toISOString()).toBe(
      '2026-08-12T00:00:00.000Z',
    );
  });
});

describe('week', () => {
  it('starts on Sunday', () => {
    // 12 August 2026 is a Wednesday.
    expect(startOfWeek(day(2026, 8, 12)).toISOString()).toBe('2026-08-09T00:00:00.000Z');
  });
});

describe('relativeDayLabel', () => {
  const base = day(2026, 8, 12);

  it.each([
    [0, 'היום'],
    [1, 'מחר'],
    [2, 'מחרתיים'],
    [-1, 'אתמול'],
  ])('offset %i reads as %s', (offset, expected) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + offset);
    expect(relativeDayLabel(d, base)).toBe(expected);
  });

  it('names the weekday inside the coming week', () => {
    expect(relativeDayLabel(day(2026, 8, 16), base)).toBe('יום ראשון');
  });

  it('falls back to a numeric date beyond a week', () => {
    expect(relativeDayLabel(day(2026, 8, 25), base)).toBe('25.08');
  });

  it('shows past dates numerically', () => {
    expect(relativeDayLabel(day(2026, 8, 5), base)).toBe('05.08');
  });
});

describe('toDayStart', () => {
  it('collapses an evening timestamp to the Israeli day that contains it', () => {
    expect(toDayStart(new Date('2026-08-12T22:30:00.000Z')).toISOString()).toBe(
      '2026-08-13T00:00:00.000Z',
    );
  });
});
