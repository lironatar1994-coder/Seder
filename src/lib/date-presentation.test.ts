import { describe, expect, it } from 'vitest';
import { dateTone, schedulePresentation } from './date-presentation';
import { addDays, today } from './dates';

describe('scheduled date presentation', () => {
  const now = new Date('2026-10-08T07:00:00Z'); // 10:00 in Israel
  const base = today(now);

  it.each([[-1, 'overdue'], [0, 'today'], [1, 'tomorrow'], [2, 'week'], [6, 'week'], [7, 'later'], [45, 'later']] as const)('classifies %i calendar days from today', (offset, expected) => {
    expect(dateTone(addDays(base, offset), now)).toBe(expected);
  });

  it('uses the Israeli day across UTC midnight', () => {
    expect(dateTone(base, new Date('2026-10-07T21:30:00Z'))).toBe('today');
  });

  it('only marks the date on past days, regardless of the hour', () => {
    expect(schedulePresentation(addDays(base, -1), '09:00', now)).toEqual({ dateTone: 'overdue', timeOverdue: false });
  });

  it('only marks the hour after its minute has elapsed today', () => {
    expect(schedulePresentation(base, '09:59', now)).toEqual({ dateTone: 'none', timeOverdue: true });
    expect(schedulePresentation(base, '10:00', now)).toEqual({ dateTone: 'today', timeOverdue: false });
    expect(schedulePresentation(base, null, now)).toEqual({ dateTone: 'today', timeOverdue: false });
  });

  it('never marks a future or completed task late', () => {
    expect(schedulePresentation(addDays(base, 1), '01:00', now)).toEqual({ dateTone: 'tomorrow', timeOverdue: false });
    expect(schedulePresentation(addDays(base, -1), '09:00', now, true)).toEqual({ dateTone: 'none', timeOverdue: false });
  });
});
