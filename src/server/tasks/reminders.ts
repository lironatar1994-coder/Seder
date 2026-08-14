import type { Prisma } from '@prisma/client';
import { REMINDER_OFF } from '@/lib/reminder';

/**
 * Which tasks are due a reminder.
 *
 * Extracted from the worker for one reason: the filter below is wrong in a way
 * no amount of reading catches, and the only test that can catch it is one
 * that runs it against a real database. See `reminders.test.ts`.
 *
 * **The trap.** `NOT: { reminder: 'off' }` and `reminder: { not: 'off' }` both
 * compile to a comparison against NULL, and in SQL `NULL = 'off'` is NULL — not
 * false. Negating NULL is still NULL, which is not true, so the row is
 * filtered out. `null` is the *default* state of this column, so both spellings
 * silently exclude every task that never asked for anything in particular:
 * which is to say, all of them.
 *
 * The explicit OR is the only form that keeps them.
 */
export const remindable: Prisma.TaskWhereInput = {
  OR: [{ reminder: null }, { reminder: { not: REMINDER_OFF } }],
};

/** Whoever is doing the task is who hears about it — the assignee in a shared
 *  project, otherwise the author. */
const reachable: Prisma.TaskWhereInput = {
  OR: [
    { assigneeId: null, user: { whatsappReminders: true, phone: { not: null } } },
    { assignee: { whatsappReminders: true, phone: { not: null } } },
  ],
};

/**
 * Tasks on `day` with a time of their own, still waiting for their reminder.
 *
 * `AND` rather than spreading, because `remindable` and `reachable` each carry
 * their own `OR` — spread into one object the second would overwrite the first,
 * and the filter would quietly stop being about reminders at all.
 */
export function timedDueWhere(day: Date): Prisma.TaskWhereInput {
  return {
    status: 'TODO',
    scheduledFor: day,
    scheduledTime: { not: null },
    remindedAt: null,
    parentId: null,
    AND: [remindable, reachable],
  };
}

/** Tasks on `day` with a date but no time — the ones the morning note covers. */
export function untimedDueWhere(day: Date): Prisma.TaskWhereInput {
  return {
    status: 'TODO',
    scheduledFor: day,
    scheduledTime: null,
    remindedAt: null,
    parentId: null,
    AND: [remindable, reachable],
  };
}
