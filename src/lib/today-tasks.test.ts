import { describe, expect, it } from 'vitest';
import { todayTaskGroups } from './today-tasks';
import { isScheduleOverdue } from './dates';

const day = (value: string) => new Date(`${value}T00:00:00Z`);
const task = (id: string, date: string | null, time: string | null = null, deadline: string | null = null) => ({
  id, scheduledFor: date ? day(date) : null, scheduledTime: time, deadline: deadline ? day(deadline) : null,
});

describe('Israeli schedule lateness', () => {
  const now = new Date('2026-10-04T16:41:30Z'); // 19:41 Israel
  it('moves elapsed hours today into overdue, without completing or changing the task', () => {
    const input = [task('past', '2026-10-04', '14:00'), task('later', '2026-10-04', '20:00'), task('untimed', '2026-10-04')];
    const groups = todayTaskGroups(input, now);
    expect(groups[0].tasks.map(item => item.id)).toEqual(['past']);
    expect(groups[1].tasks.map(item => item.id)).toEqual(['later', 'untimed']);
    expect(groups[0].tasks[0]).toBe(input[0]);
    expect(input[0].scheduledTime).toBe('14:00');
  });
  it('keeps the displayed minute current until it has passed', () => {
    expect(isScheduleOverdue(day('2026-10-04'), '19:41', now)).toBe(false);
    expect(isScheduleOverdue(day('2026-10-04'), '19:40', now)).toBe(true);
  });
  it('does not treat a future day or a day-only task as elapsed', () => {
    expect(isScheduleOverdue(day('2026-10-05'), '00:01', now)).toBe(false);
    expect(isScheduleOverdue(day('2026-10-04'), null, now)).toBe(false);
    expect(isScheduleOverdue(null, '09:00', now)).toBe(false);
  });
  it('keeps deadlines independent: today is current, yesterday is overdue', () => {
    const groups = todayTaskGroups([task('due-today', null, null, '2026-10-04'), task('due-yesterday', null, null, '2026-10-03')], now);
    expect(groups[0].tasks.map(item => item.id)).toEqual(['due-yesterday']);
    expect(groups[1].tasks.map(item => item.id)).toEqual(['due-today']);
  });
  it('uses winter time rather than the machine timezone', () => {
    expect(isScheduleOverdue(day('2026-01-15'), '09:00', new Date('2026-01-15T07:01:00Z'))).toBe(true);
    expect(isScheduleOverdue(day('2026-01-15'), '09:00', new Date('2026-01-15T06:59:00Z'))).toBe(false);
  });
  it('resolves time using the offset at the hour on a clock-change day', () => {
    expect(isScheduleOverdue(day('2026-03-27'), '03:15', new Date('2026-03-27T00:16:00Z'))).toBe(true);
    expect(isScheduleOverdue(day('2026-10-25'), '02:15', new Date('2026-10-25T00:16:00Z'))).toBe(true);
  });
  it('moves untimed work only when the Israeli date changes', () => {
    const groups = todayTaskGroups([task('day-only', '2026-10-04')], new Date('2026-10-04T21:01:00Z'));
    expect(groups[0].key).toBe('overdue');
    expect(groups[0].tasks[0].id).toBe('day-only');
  });
  it('preserves manual order within each group and has no duplicate rows', () => {
    const groups = todayTaskGroups([task('a', '2026-10-03'), task('b', '2026-10-04', '23:00'), task('c', '2026-10-04', '09:00')], now);
    expect(groups.flatMap(group => group.tasks.map(item => item.id))).toEqual(['a', 'c', 'b']);
  });
});
