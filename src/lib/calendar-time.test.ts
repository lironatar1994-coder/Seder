import { describe, expect, it } from 'vitest';
import {
  clampStart,
  formatRange,
  fromMinutes,
  jerusalemMinutes,
  layoutSpans,
  snapMinutes,
  toMinutes,
} from './calendar-time';

describe('clock conversion', () => {
  it('round-trips HH:mm', () => {
    expect(toMinutes('09:45')).toBe(585);
    expect(fromMinutes(585)).toBe('09:45');
    expect(toMinutes('24:00')).toBeNull();
    expect(toMinutes('9:00')).toBeNull();
  });

  it('clamps to the day', () => {
    expect(fromMinutes(-20)).toBe('00:00');
    expect(fromMinutes(2000)).toBe('23:59');
    expect(clampStart(1430, 30)).toBe(1410);
  });

  it('snaps to the quarter hour', () => {
    expect(snapMinutes(607)).toBe(600);
    expect(snapMinutes(608)).toBe(615);
  });

  it('formats a range', () => {
    expect(formatRange(540, 630)).toBe('09:00–10:30');
  });

  it('reads instants in Israel time, across DST', () => {
    expect(jerusalemMinutes('2026-07-01T06:00:00.000Z')).toBe(9 * 60); // IDT, UTC+3
    expect(jerusalemMinutes('2026-12-01T07:00:00.000Z')).toBe(9 * 60); // IST, UTC+2
  });
});

describe('layoutSpans', () => {
  it('keeps separate blocks full width', () => {
    const placed = layoutSpans([
      { start: 540, end: 600 },
      { start: 600, end: 660 },
    ]);
    expect(placed.map((p) => [p.lane, p.lanes])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it('splits an overlapping cluster and reuses a freed lane', () => {
    const placed = layoutSpans([
      { start: 540, end: 660, id: 'a' },
      { start: 570, end: 600, id: 'b' },
      { start: 600, end: 630, id: 'c' },
    ]);
    const byId = Object.fromEntries(placed.map((p) => [p.item.id, p]));
    expect(byId.a).toMatchObject({ lane: 0, lanes: 2 });
    expect(byId.b).toMatchObject({ lane: 1, lanes: 2 });
    expect(byId.c).toMatchObject({ lane: 1, lanes: 2 });
  });

  it('treats very short tasks as at least a quarter hour tall', () => {
    const placed = layoutSpans([
      { start: 540, end: 541 },
      { start: 550, end: 560 },
    ]);
    expect(placed[1].lanes).toBe(2);
  });
});
