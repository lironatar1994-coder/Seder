import { describe, expect, it } from 'vitest';
import {
  buildMonthGrid,
  buildWeekGrid,
  parseMonthAnchor,
  shiftMonth,
  shiftWeek,
} from './calendar';

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

// Wednesday 12 August 2026.
const TODAY = day(2026, 8, 12);

describe('month grid', () => {
  const grid = buildMonthGrid(day(2026, 8, 1), TODAY);

  it('is always six full weeks, so months do not change the layout height', () => {
    expect(grid.weeks).toHaveLength(6);
    expect(grid.days).toHaveLength(42);
    grid.weeks.forEach((w) => expect(w.days).toHaveLength(7));
  });

  it('starts each week on Sunday — the Israeli week', () => {
    grid.weeks.forEach((week) => {
      expect(week.days[0].date.getUTCDay()).toBe(0);
      expect(week.days[6].date.getUTCDay()).toBe(6);
    });
  });

  it('pads with the surrounding days and marks them out of month', () => {
    // 1 August 2026 is a Saturday, so the first row is 26–31 July then 1 Aug.
    expect(grid.days[0].iso).toBe('2026-07-26');
    expect(grid.days[0].inMonth).toBe(false);
    expect(grid.days[6].iso).toBe('2026-08-01');
    expect(grid.days[6].inMonth).toBe(true);
  });

  it('treats Friday and Saturday as the weekend', () => {
    const friday = grid.days.find((d) => d.iso === '2026-08-14')!;
    const saturday = grid.days.find((d) => d.iso === '2026-08-15')!;
    const sunday = grid.days.find((d) => d.iso === '2026-08-16')!;

    expect(friday.isWeekend).toBe(true);
    expect(friday.isShabbat).toBe(false);
    expect(saturday.isWeekend).toBe(true);
    expect(saturday.isShabbat).toBe(true);
    expect(sunday.isWeekend).toBe(false);
  });

  it('marks today exactly once', () => {
    expect(grid.days.filter((d) => d.isToday).map((d) => d.iso)).toEqual(['2026-08-12']);
  });

  it('carries the Hebrew day in gematria, never Latin digits', () => {
    const today = grid.days.find((d) => d.iso === '2026-08-12')!;
    expect(today.hebrewDay).toBe('כ״ט');
    grid.days.forEach((d) => expect(d.hebrewDay).not.toMatch(/\d/));
  });

  it('labels the Hebrew month only on Rosh Chodesh', () => {
    const labelled = grid.days.filter((d) => d.hebrewMonthLabel);
    // Six weeks spanning late July to early September touch Av and Elul.
    expect(labelled.length).toBeGreaterThanOrEqual(1);
    labelled.forEach((d) => expect(d.hebrewDay).toBe('א׳'));
  });

  it('names both calendars in the header', () => {
    expect(grid.gregorianMonth).toBe('אוגוסט');
    expect(grid.gregorianYear).toBe(2026);
    expect(grid.hebrewRange).toContain('אב');
    expect(grid.hebrewRange).toContain('אלול');
    expect(grid.hebrewRange).toContain('ה׳תשפ״ו');
  });

  it('exposes the neighbouring month anchors', () => {
    expect(grid.prevAnchor).toBe('2026-07');
    expect(grid.nextAnchor).toBe('2026-09');
  });

  it('rolls the year at the boundaries', () => {
    expect(buildMonthGrid(day(2026, 1, 1), TODAY).prevAnchor).toBe('2025-12');
    expect(buildMonthGrid(day(2026, 12, 1), TODAY).nextAnchor).toBe('2027-01');
  });
});

describe('week grid', () => {
  it('runs Sunday to Saturday around the anchor', () => {
    const week = buildWeekGrid(TODAY, TODAY);
    expect(week.days).toHaveLength(7);
    expect(week.days[0].iso).toBe('2026-08-09');
    expect(week.days[6].iso).toBe('2026-08-15');
    expect(week.days[0].date.getUTCDay()).toBe(0);
  });

  it('labels a week inside one month compactly', () => {
    expect(buildWeekGrid(TODAY, TODAY).label).toBe('9–15 באוגוסט');
  });

  it('names both months when the week straddles them', () => {
    expect(buildWeekGrid(day(2026, 8, 31), TODAY).label).toBe('30 באוגוסט – 5 בספטמבר');
  });

  it('steps a whole week at a time', () => {
    expect(shiftWeek(TODAY, -1)).toBe('2026-08-02');
    expect(shiftWeek(TODAY, 1)).toBe('2026-08-16');
  });
});

describe('anchors', () => {
  it('parses a valid YYYY-MM', () => {
    expect(parseMonthAnchor('2027-03', TODAY).toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });

  it.each(['', 'nonsense', '2026-13', '2026-00', '26-03', undefined])(
    'falls back to the current month for %s',
    (value) => {
      expect(parseMonthAnchor(value as string | undefined, TODAY).toISOString()).toBe(
        '2026-08-01T00:00:00.000Z',
      );
    },
  );

  it('shifts months without drifting on long months', () => {
    // 31 January + 1 month must not skip to March.
    expect(shiftMonth(day(2026, 1, 31), 1)).toBe('2026-02');
  });
});
