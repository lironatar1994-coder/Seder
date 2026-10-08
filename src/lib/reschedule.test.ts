import { describe, expect, it } from 'vitest';
import { rescheduleDate } from './reschedule';
import { quickAddReschedulePreset } from './quick-add-selection';
import { parseQuickAdd } from './quick-add-parser';

const now = new Date('2026-10-08T10:00:00Z');
describe('reschedule by the original relative choice', () => {
  it.each([
    ['today', '2026-10-08'], ['tomorrow', '2026-10-09'], ['next-week', '2026-10-11'],
    [null, '2026-10-08'], [undefined, '2026-10-08'],
  ])('resolves %s from the current Israeli day', (preset, day) => {
    expect(rescheduleDate(preset, now).toISOString().slice(0, 10)).toBe(day);
  });
  it('next week on Sunday means the following Sunday', () => {
    expect(rescheduleDate('next-week', new Date('2026-10-11T10:00:00Z')).toISOString().slice(0, 10)).toBe('2026-10-18');
  });
  it('uses the Israeli date near midnight rather than the UTC date', () => {
    expect(rescheduleDate('tomorrow', new Date('2026-10-08T22:30:00Z')).toISOString().slice(0, 10)).toBe('2026-10-10');
  });
  it.each([['היום', 'today'], ['מחר', 'tomorrow'], ['שבוע הבא', 'next-week']])('remembers a typed %s', (word, preset) => {
    expect(quickAddReschedulePreset(parseQuickAdd(`משימה ${word}`, now))).toBe(preset);
  });
  it('remembers picker choices through a typed time and ordinary title edits', () => {
    expect(quickAddReschedulePreset(parseQuickAdd('משימה בשעה 14:30', now), { schedule: { bucket: 'SCHEDULED', date: '2026-10-09', preset: 'tomorrow' } })).toBe('tomorrow');
  });
  it('a typed day takes over from an earlier picker choice without mistaking a deadline for the schedule', () => {
    expect(quickAddReschedulePreset(parseQuickAdd('משימה שבוע הבא עד מחר', now), { schedule: { bucket: 'SCHEDULED', date: '2026-10-09', preset: 'tomorrow' } })).toBe('next-week');
  });
});
