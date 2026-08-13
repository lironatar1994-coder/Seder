import { describe, expect, it } from 'vitest';
import { toGematria, toHebrewYear } from './gematria';
import { buildLockup, hebrewDayMonth, hebrewYear } from './hebrew-date';

describe('gematria', () => {
  it.each([
    [1, 'א׳'],
    [5, 'ה׳'],
    [9, 'ט׳'],
    [10, 'י׳'],
    [11, 'י״א'],
    [20, 'כ׳'],
    [29, 'כ״ט'],
    [30, 'ל׳'],
    [100, 'ק׳'],
    [123, 'קכ״ג'],
    [400, 'ת׳'],
    [786, 'תשפ״ו'],
  ])('%i → %s', (n, expected) => {
    expect(toGematria(n)).toBe(expected);
  });

  it('avoids spelling the divine name at 15 and 16', () => {
    expect(toGematria(15)).toBe('ט״ו');
    expect(toGematria(16)).toBe('ט״ז');
    // The rule applies to the trailing pair, not only to bare 15/16.
    expect(toGematria(115)).toBe('קט״ו');
    expect(toGematria(116)).toBe('קט״ז');
  });

  it('writes years in the ה׳ short form', () => {
    expect(toHebrewYear(5786)).toBe('ה׳תשפ״ו');
    expect(toHebrewYear(5784)).toBe('ה׳תשפ״ד');
  });
});

describe('hebrew calendar', () => {
  it('renders the day in Hebrew numerals, not Latin digits', () => {
    // 12 August 2026 is 29 Av 5786.
    const value = hebrewDayMonth(new Date(Date.UTC(2026, 7, 12)));
    expect(value).toBe('כ״ט באב');
    expect(value).not.toMatch(/\d/);
  });

  it('renders the year in Hebrew numerals', () => {
    expect(hebrewYear(new Date(Date.UTC(2026, 7, 12)))).toBe('ה׳תשפ״ו');
  });

  it('keeps the Adar א׳/ב׳ distinction in a leap year', () => {
    // 5784 is a leap year; 15 March 2024 falls in Adar II.
    expect(hebrewDayMonth(new Date(Date.UTC(2024, 2, 15)))).toContain('אדר ב׳');
  });

  it('builds both calendars for the lockup', () => {
    const lockup = buildLockup(new Date(Date.UTC(2026, 7, 12)));
    expect(lockup.weekday).toBe('יום רביעי');
    expect(lockup.hebrew).toBe('כ״ט באב');
    expect(lockup.gregorian).toBe('12.08');
    expect(lockup.gregorianFull).toBe('12.08.2026');
  });
});
