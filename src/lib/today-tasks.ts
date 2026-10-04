import { isOverdue, isScheduleOverdue, today } from './dates';

interface Timing {
  scheduledFor: Date | null;
  scheduledTime?: string | null;
  deadline: Date | null;
}

/** Classification changes with the clock, never with task completion or dates. */
export function todayTaskGroups<T extends Timing>(tasks: T[], now: Date = new Date()) {
  const base = today(now);
  const late: T[] = [], remaining: T[] = [];
  for (const task of tasks) {
    const overdue = isScheduleOverdue(task.scheduledFor, task.scheduledTime, now) || isOverdue(task.deadline, base);
    (overdue ? late : remaining).push(task);
  }
  const groups = [];
  if (late.length) groups.push({ key: 'overdue', title: 'באיחור', tasks: late });
  groups.push({ key: 'today', title: late.length ? 'היום' : null, tasks: remaining });
  return groups;
}
