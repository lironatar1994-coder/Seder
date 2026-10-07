import { daysBetween, isScheduleOverdue, today } from './dates';

export type DateTone = 'none' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

/** Calendar meaning is independent of the user's action accent. */
export function dateTone(date: Date | null | undefined, now = new Date()): DateTone {
  if (!date) return 'none';
  const distance = daysBetween(today(now), date);
  if (distance < 0) return 'overdue';
  if (distance === 0) return 'today';
  if (distance === 1) return 'tomorrow';
  if (distance < 7) return 'week';
  return 'later';
}

/** Exactly one overdue signal: the day, or today's elapsed hour. */
export function schedulePresentation(date: Date, time?: string | null, now = new Date(), muted = false) {
  if (muted) return { dateTone: 'none' as DateTone, timeOverdue: false };
  const tone = dateTone(date, now);
  const timeOverdue = tone === 'today' && isScheduleOverdue(date, time, now);
  return { dateTone: timeOverdue ? 'none' as DateTone : tone, timeOverdue };
}
