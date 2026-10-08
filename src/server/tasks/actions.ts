'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { requireUser } from '@/server/auth/session';
import { nextOccurrence, parseRecurrence } from '@/lib/recurrence';
import { relativeDayLabel, today, toDayStart, isOverdue, isScheduleOverdue } from '@/lib/dates';
import { rescheduleDate, type ReschedulePreset } from '@/lib/reschedule';
import { keyAfterLast, keyBetween } from '@/lib/ordering';
import { titleSchema, updateTaskSchema, fieldErrors } from '@/lib/validation';
import { captureTask, type ActionResult, type QuickAddContext, type QuickAddResult } from '@/server/tasks/capture';
import {
  taskSelect,
  getLogbookPage,
  toDTO,
  type LogbookPage,
  type TaskDTO,
} from '@/server/tasks/queries';
import { canUseProject, canUseTask, visibleTasks } from '@/server/access';
import type { Priority, WhenBucket } from '@/lib/constants';

/** The result shapes live beside `captureTask`, which the WhatsApp worker also
 *  calls without going through any action. Re-exported here so every caller
 *  keeps importing them from the module whose functions return them. */
export type { ActionResult, QuickAddResult, QuickAddContext } from '@/server/tasks/capture';

/** Every mutation refreshes the whole authenticated segment: the sidebar counts
 *  are as much a part of the answer as the list itself. */
function refresh() {
  revalidatePath('/app', 'layout');
}

function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Stored dates are UTC midnight, so slicing the ISO string is the day. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}


/**
 * Quick add, from the web.
 *
 * The work is in `captureTask`, which knows nothing about sessions or caches —
 * so the WhatsApp worker can call the same function and file a task in exactly
 * the same place, with exactly the same parse. All this adds is who is asking
 * and what to revalidate afterwards.
 */
export async function quickAddAction(
  text: string,
  context: QuickAddContext = {},
): Promise<QuickAddResult> {
  const user = await requireUser();
  const result = await captureTask(user.id, text, context);
  if (result.ok) refresh();
  return result;
}

export interface ToggleResult extends ActionResult {
  /** Present only when completing a repeating task, so the undo can put both
   *  the advanced row and the logged copy back. */
  repeat?: {
    snapshotId: string;
    /** The occurrence that was just completed, "YYYY-MM-DD" or null. */
    previousDate: string | null;
    /** Where the task moved to, "YYYY-MM-DD". */
    nextDate: string;
    /** Hebrew label for the toast, e.g. "יום שני". */
    nextLabel: string;
  };
}

/** Everything completing one task correctly needs to know about it. */
const COMPLETE_SELECT = {
  id: true,
  title: true,
  notes: true,
  priority: true,
  projectId: true,
  sectionId: true,
  recurrence: true,
  scheduledFor: true,
  scheduledTime: true,
  durationMinutes: true,
  assigneeId: true,
  deadline: true,
  position: true,
  labels: { select: { labelId: true } },
} as const;

type Completable = {
  id: string;
  title: string;
  notes: string | null;
  priority: number;
  projectId: string | null;
  sectionId: string | null;
  recurrence: string | null;
  scheduledFor: Date | null;
  scheduledTime: string | null;
  durationMinutes: number;
  assigneeId: string | null;
  deadline: Date | null;
  position: string;
  labels: { labelId: string }[];
};

type Repeat = NonNullable<ToggleResult['repeat']>;

/**
 * Completes one task, advancing it instead if it repeats. Shared by the single
 * toggle and the bulk bar: a repeating task must behave identically whether it
 * was ticked on its own or as one of twelve, and a bulk `updateMany` would
 * quietly finish it dead and leave its checklist open.
 *
 * Returns the repeat details when the task moved rather than finished.
 */
async function completeOne(userId: string, task: Completable): Promise<Repeat | null> {
  const rule = parseRecurrence(task.recurrence);

  if (rule) {
    // A repeating task is never "finished" — this occurrence is. Log a copy so
    // the Logbook shows real history, then move the live row to the next date.
    const completedOccurrence = task.scheduledFor ?? today();
    const next = nextOccurrence(rule, toDayStart(completedOccurrence));

    // A deadline travels with the task by the same number of days, so
    // "do it Monday, due Wednesday" stays two days apart every cycle.
    const deadlineShift = task.deadline
      ? next.getTime() - toDayStart(completedOccurrence).getTime()
      : 0;

    const snapshot = await db.task.create({
      data: {
        userId,
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        projectId: task.projectId,
        sectionId: task.sectionId,
        status: 'DONE',
        completedAt: new Date(),
        whenBucket: 'SCHEDULED',
        scheduledFor: completedOccurrence,
        scheduledTime: task.scheduledTime,
        durationMinutes: task.durationMinutes,
        assigneeId: task.assigneeId,
        deadline: task.deadline,
        position: task.position,
        recurrenceParentId: task.id,
        labels: task.labels.length
          ? { create: task.labels.map((l) => ({ labelId: l.labelId })) }
          : undefined,
      },
      select: { id: true },
    });

    await db.task.update({
      where: { id: task.id },
      data: {
        whenBucket: 'SCHEDULED',
        scheduledFor: next,
        deadline: task.deadline ? new Date(task.deadline.getTime() + deadlineShift) : null,
      },
    });

    // The checklist starts over with the new occurrence.
    await db.task.updateMany({
      where: { parentId: task.id },
      data: { status: 'TODO', completedAt: null },
    });

    return {
      snapshotId: snapshot.id,
      previousDate: task.scheduledFor ? isoDay(task.scheduledFor) : null,
      nextDate: isoDay(next),
      nextLabel: relativeDayLabel(next, today()),
    };
  }

  await db.task.update({
    where: { id: task.id },
    data: { status: 'DONE', completedAt: new Date() },
  });

  // Completing a parent closes its checklist too.
  await db.task.updateMany({
    where: { parentId: task.id, status: 'TODO' },
    data: { status: 'DONE', completedAt: new Date() },
  });

  return null;
}

export async function toggleTaskAction(id: string, done: boolean): Promise<ToggleResult> {
  const user = await requireUser();

  // Anyone in the project can tick anything off. A shared list where you can
  // see a task but not close it is not collaboration.
  if (!(await canUseTask(user.id, id))) return { ok: false, error: 'המשימה לא נמצאה' };

  const task = await db.task.findUnique({ where: { id }, select: COMPLETE_SELECT });
  if (!task) return { ok: false, error: 'המשימה לא נמצאה' };

  if (!done) {
    // Reopening leaves the checklist alone — the user may only want the parent
    // back, and re-ticking the parent would close it again anyway.
    await db.task.update({
      where: { id },
      data: { status: 'TODO', completedAt: null },
    });
    refresh();
    return { ok: true };
  }

  const repeat = await completeOne(user.id, task);
  refresh();
  return { ok: true, repeat: repeat ?? undefined };
}

/** Reverses a repeat completion: bins the logged copy and rolls the live task
 *  back to the occurrence it was on. */
export async function undoRepeatAction(
  id: string,
  snapshotId: string,
  previousDate: string | null,
): Promise<ActionResult> {
  const user = await requireUser();

  if (!(await canUseTask(user.id, id))) return { ok: false, error: 'המשימה לא נמצאה' };

  const task = await db.task.findUnique({
    where: { id },
    select: { id: true, deadline: true, scheduledFor: true },
  });
  if (!task) return { ok: false, error: 'המשימה לא נמצאה' };

  const restored = parseDay(previousDate);
  const shift =
    task.deadline && restored && task.scheduledFor
      ? restored.getTime() - toDayStart(task.scheduledFor).getTime()
      : 0;

  await db.task.deleteMany({
    where: { id: snapshotId, ...(await visibleTasks(user.id)), recurrenceParentId: id },
  });

  await db.task.update({
    where: { id },
    data: {
      scheduledFor: restored,
      whenBucket: restored ? 'SCHEDULED' : 'ANYTIME',
      deadline: task.deadline ? new Date(task.deadline.getTime() + shift) : null,
    },
  });

  refresh();
  return { ok: true };
}

export async function updateTaskAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] ?? 'קלט לא תקין' };
  }

  const { id, labelIds, scheduledFor, deadline, ...rest } = parsed.data;

  if (!(await canUseTask(user.id, id))) return { ok: false, error: 'המשימה לא נמצאה' };

  /* Reaching the task is not the same as being allowed to send it somewhere.
     Without this, anyone who can edit a task could file it into a project they
     cannot open — which does not grant them access, it just makes the task
     vanish from their own account into someone else's list. */
  if (rest.projectId && !(await canUseProject(user.id, rest.projectId))) {
    return { ok: false, error: 'הפרויקט לא נמצא' };
  }
  const existing = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  const destination = rest.projectId === undefined ? existing?.projectId : rest.projectId;
  if (rest.sectionId) {
    if (!destination || !(await db.section.findFirst({ where: { id: rest.sectionId, projectId: destination } }))) return { ok: false, error: 'הקטע לא נמצא בפרויקט הזה' };
  }
  const moved = rest.projectId !== undefined && rest.projectId !== existing?.projectId;

  /* Labels are personal, so a label id arriving from the client has to be
     checked against the *sender's* labels — otherwise a collaborator editing a
     shared task could attach a label belonging to somebody else. */
  let myLabelIds: string[] | null = null;
  if (labelIds) {
    myLabelIds = (
      await db.label.findMany({ where: { userId: user.id }, select: { id: true } })
    ).map((l) => l.id);
    if (labelIds.some((id) => !myLabelIds!.includes(id))) {
      return { ok: false, error: 'תווית לא נמצאה' };
    }
  }

  /* Moving a task, or changing what it asked for, makes any reminder already
     sent about it a reminder for a different arrangement. `remindedAt` is what
     stops one firing twice; leaving it set after a reschedule is what stops
     the *new* one firing at all. */
  const reminderChanged =
    scheduledFor !== undefined || rest.scheduledTime !== undefined || rest.reminder !== undefined;

  await db.task.update({
    where: { id },
    data: {
      ...rest,
      ...(moved ? { assigneeId: null, sectionId: rest.sectionId ?? null, ...(destination === null ? { userId: user.id } : {}) } : {}),
      ...(reminderChanged ? { remindedAt: null } : {}),
      ...(scheduledFor !== undefined ? { scheduledFor: parseDay(scheduledFor) } : {}),
      ...(scheduledFor !== undefined ? { reschedulePreset: scheduledFor ? rest.reschedulePreset ?? 'today' : null } : {}),
      ...(deadline !== undefined ? { deadline: parseDay(deadline) } : {}),
      ...(labelIds
        ? {
            /* Only this user's labels are cleared. A blanket `deleteMany: {}`
               would wipe a collaborator's labels off the shared task every time
               anyone edited it, and they would have no idea why. */
            labels: {
              deleteMany: { labelId: { in: myLabelIds ?? [] } },
              create: labelIds.map((labelId) => ({ labelId })),
            },
          }
        : {}),
    },
  });

  refresh();
  return { ok: true };
}

/** Schedule, or clear the schedule, from the row menu and the date popover. */
export async function scheduleTaskAction(
  id: string,
  when: { bucket: WhenBucket; date?: string | null; time?: string | null; preset?: ReschedulePreset | null },
): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await canUseTask(user.id, id))) return { ok: false, error: 'המשימה לא נמצאה' };

  const scheduled = when.bucket === 'SCHEDULED';
  const existing = await db.task.findUnique({ where: { id }, select: { scheduledFor: true, reschedulePreset: true } });
  const sameDay = existing?.scheduledFor && isoDay(existing.scheduledFor) === when.date;
  await db.task.update({
    where: { id },
    data: {
      whenBucket: when.bucket,
      scheduledFor: scheduled ? parseDay(when.date) : null,
      scheduledTime: scheduled ? when.time ?? null : null,
      reschedulePreset: scheduled ? when.preset ?? (sameDay ? existing.reschedulePreset : 'today') : null,
      // The task has moved, so anything already sent about it was about the
      // old date. Left set, the reminder for the new one never fires.
      remindedAt: null,
    },
  });

  refresh();
  return { ok: true };
}

export async function setDeadlineAction(id: string, date: string | null): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await canUseTask(user.id, id))) return { ok: false, error: 'המשימה לא נמצאה' };

  await db.task.update({ where: { id }, data: { deadline: parseDay(date) } });
  refresh();
  return { ok: true };
}

export async function setPriorityAction(id: string, priority: Priority): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await canUseTask(user.id, id))) return { ok: false, error: 'המשימה לא נמצאה' };

  await db.task.update({ where: { id }, data: { priority } });
  refresh();
  return { ok: true };
}

/**
 * Hand a task to someone, or drop it back to unclaimed.
 *
 * One assignee, not several — the same choice Todoist makes, and for the same
 * reason: two names on a task is how a task ends up with nobody doing it.
 */
export async function assignTaskAction(
  id: string,
  assigneeId: string | null,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await canUseTask(user.id, id))) return { ok: false, error: 'המשימה לא נמצאה' };

  const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return { ok: false, error: 'המשימה לא נמצאה' };

  if (assigneeId) {
    // Only into a project, and only to somebody actually in it. Assigning an
    // unfiled task would hand over something the recipient cannot see: the
    // Inbox is private, and access comes from the project.
    if (!task.projectId) return { ok: false, error: 'אפשר להקצות רק משימות בתוך פרויקט' };
    if (!(await canUseProject(assigneeId, task.projectId))) {
      return { ok: false, error: 'אפשר להקצות רק למי שחבר בפרויקט' };
    }
  }

  await db.task.update({ where: { id }, data: { assigneeId } });
  refresh();
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await canUseTask(user.id, id))) return { ok: false, error: 'המשימה לא נמצאה' };
  const result = await db.task.deleteMany({ where: { id } });
  if (result.count === 0) return { ok: false, error: 'המשימה לא נמצאה' };
  refresh();
  return { ok: true };
}

/**
 * Reorder. The client sends the ids of the new neighbours rather than an index,
 * so a stale list on the client cannot corrupt the order — the server derives
 * the key from whatever those rows actually hold now.
 */
export async function reorderTaskAction(
  id: string,
  beforeId: string | null,
  afterId: string | null,
  target?: { projectId?: string | null; sectionId?: string | null; bucket?: WhenBucket },
): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await canUseTask(user.id, id))) return { ok: false, error: 'המשימה לא נמצאה' };

  const [before, after] = await Promise.all([
    beforeId
      ? db.task.findFirst({
          where: { id: beforeId, ...(await visibleTasks(user.id)) },
          select: { position: true },
        })
      : null,
    afterId
      ? db.task.findFirst({
          where: { id: afterId, ...(await visibleTasks(user.id)) },
          select: { position: true },
        })
      : null,
  ]);

  await db.task.update({
    where: { id },
    data: {
      position: keyBetween(before?.position ?? null, after?.position ?? null),
      ...(target?.projectId !== undefined ? { projectId: target.projectId } : {}),
      ...(target?.sectionId !== undefined ? { sectionId: target.sectionId } : {}),
      ...(target?.bucket ? { whenBucket: target.bucket } : {}),
    },
  });

  refresh();
  return { ok: true };
}

/* --------------------------------------------------------------- subtasks */

export async function addSubtaskAction(parentId: string, title: string): Promise<ActionResult> {
  const user = await requireUser();
  const check = titleSchema.safeParse(title);
  if (!check.success) return { ok: false, error: 'לכל פריט צריך שם' };

  if (!(await canUseTask(user.id, parentId))) return { ok: false, error: 'המשימה לא נמצאה' };

  const parent = await db.task.findUnique({
    where: { id: parentId },
    select: { id: true, projectId: true },
  });
  if (!parent) return { ok: false, error: 'המשימה לא נמצאה' };

  const siblings = await db.task.findMany({
    where: { parentId },
    select: { position: true },
    orderBy: { position: 'asc' },
  });

  const created = await db.task.create({
    data: {
      userId: user.id,
      parentId,
      projectId: parent.projectId,
      title: check.data,
      whenBucket: 'ANYTIME',
      position: keyAfterLast(siblings),
    },
    select: { id: true },
  });

  refresh();
  return { ok: true, id: created.id };
}

/**
 * Free-text search over titles and notes, for the command palette.
 *
 * No `mode: 'insensitive'` — SQLite does not support it, and it is not needed:
 * Hebrew has no case, and SQLite's LIKE is already case-insensitive for ASCII.
 * Open tasks come first; a finished one is usually not what you are hunting for.
 */
/** Reload a history destination against current task access and data. */
export async function getNavigationTaskAction(id: string): Promise<TaskDTO | null> {
  const user = await requireUser();
  const task = await db.task.findFirst({
    where: { id, ...(await visibleTasks(user.id)) },
    select: taskSelect(user.id),
  });
  return task ? toDTO(task) : null;
}

export async function searchTasksAction(query: string): Promise<TaskDTO[]> {
  const user = await requireUser();
  const term = query.trim();
  if (term.length < 2) return [];

  const rows = await db.task.findMany({
    where: {
      ...(await visibleTasks(user.id)),
      OR: [{ title: { contains: term } }, { notes: { contains: term } }],
    },
    select: taskSelect(user.id),
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 20,
  });

  return rows.map(toDTO);
}

/** Next page of the Logbook. The cursor comes from the previous page, so the
 *  window cannot shift under the reader when something new is completed. */
export async function loadMoreLogbookAction(cursor: string): Promise<LogbookPage> {
  const user = await requireUser();
  return getLogbookPage(user.id, cursor);
}

/* ------------------------------------------------------------------- bulk */

/**
 * Every bulk action reports how many rows it actually touched, and `count` is
 * the number the server changed — not the number the client asked for. A
 * selection can go stale, and a toast that says "7 completed" when four of them
 * were already gone is a lie the user has no way to catch.
 */
export interface BulkResult extends ActionResult {
  count: number;
}

/** Enough to reverse a bulk completion: plain rows reopen, repeats roll back. */
export interface BulkCompleteResult extends BulkResult {
  undo: {
    plain: string[];
    repeats: { id: string; snapshotId: string; previousDate: string | null }[];
  };
}

/** Narrows a selection to rows this user actually owns. Every bulk write goes
 *  through it, so ownership is enforced once rather than per action. */
async function ownedIds(userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db.task.findMany({
    where: { id: { in: ids }, ...(await visibleTasks(userId)) },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function bulkCompleteAction(ids: string[]): Promise<BulkCompleteResult> {
  const user = await requireUser();
  const empty = { ok: true as const, count: 0, undo: { plain: [], repeats: [] } };
  if (!ids.length) return empty;

  const tasks = await db.task.findMany({
    where: { id: { in: ids }, ...(await visibleTasks(user.id)), status: 'TODO' },
    select: COMPLETE_SELECT,
  });
  if (!tasks.length) return empty;

  // Sequential, not `Promise.all`: a repeating task writes three rows and reads
  // its own position, and SQLite serialises writers anyway. A hand-made
  // selection is tens of rows, so the round trips are not worth the risk.
  const undo: BulkCompleteResult['undo'] = { plain: [], repeats: [] };
  for (const task of tasks) {
    const repeat = await completeOne(user.id, task);
    if (repeat) {
      undo.repeats.push({
        id: task.id,
        snapshotId: repeat.snapshotId,
        previousDate: repeat.previousDate,
      });
    } else {
      undo.plain.push(task.id);
    }
  }

  refresh();
  return { ok: true, count: tasks.length, undo };
}

/** Reverses `bulkCompleteAction`, including the repeats it advanced. */
export async function bulkUndoCompleteAction(
  undo: BulkCompleteResult['undo'],
): Promise<ActionResult> {
  const user = await requireUser();

  if (undo.plain.length) {
    await db.task.updateMany({
      where: { id: { in: undo.plain }, ...(await visibleTasks(user.id)) },
      data: { status: 'TODO', completedAt: null },
    });
  }

  for (const repeat of undo.repeats) {
    await undoRepeatAction(repeat.id, repeat.snapshotId, repeat.previousDate);
  }

  refresh();
  return { ok: true };
}

export async function bulkScheduleAction(
  ids: string[],
  when: { bucket: WhenBucket; date?: string | null; preset?: ReschedulePreset | null },
): Promise<BulkResult> {
  const user = await requireUser();
  const owned = await ownedIds(user.id, ids);
  if (!owned.length) return { ok: true, count: 0 };

  const scheduled = when.bucket === 'SCHEDULED';
  const result = await db.task.updateMany({
    where: { id: { in: owned } },
    data: {
      whenBucket: when.bucket,
      scheduledFor: scheduled ? parseDay(when.date) : null,
      // Rescheduling a batch drops the times: they were set per task and there
      // is no single time that is right for all of them.
      scheduledTime: null,
      reschedulePreset: scheduled ? when.preset ?? 'today' : null,
      remindedAt: null,
    },
  });

  refresh();
  return { ok: true, count: result.count };
}

/** Each overdue task keeps the relative choice that originally scheduled it. */
export async function rescheduleOverdueAction(ids: string[]): Promise<BulkResult> {
  const user = await requireUser();
  const now = new Date();
  const base = today(now);
  const tasks = await db.task.findMany({
    where: { id: { in: ids }, status: 'TODO', parentId: null, ...(await visibleTasks(user.id)) },
    select: { id: true, scheduledFor: true, scheduledTime: true, deadline: true, reschedulePreset: true },
  });
  const overdue = tasks.filter(task => isScheduleOverdue(task.scheduledFor, task.scheduledTime, now) || isOverdue(task.deadline, base));
  const results = await db.$transaction(overdue.map(task => db.task.updateMany({
    where: { id: task.id, status: 'TODO' },
    data: { whenBucket: 'SCHEDULED', scheduledFor: rescheduleDate(task.reschedulePreset, now), scheduledTime: null, remindedAt: null },
  })));
  refresh();
  return { ok: true, count: results.reduce((sum, result) => sum + result.count, 0) };
}

export async function bulkPriorityAction(ids: string[], priority: Priority): Promise<BulkResult> {
  const user = await requireUser();
  const owned = await ownedIds(user.id, ids);
  if (!owned.length) return { ok: true, count: 0 };

  const result = await db.task.updateMany({ where: { id: { in: owned } }, data: { priority } });
  refresh();
  return { ok: true, count: result.count };
}

export async function bulkMoveAction(ids: string[], projectId: string | null): Promise<BulkResult> {
  const user = await requireUser();
  const owned = await ownedIds(user.id, ids);
  if (!owned.length) return { ok: true, count: 0 };

  // Moving into a project you were let into is allowed; moving into one you
  // cannot reach is how a task would disappear from its author's own account.
  if (projectId && !(await canUseProject(user.id, projectId))) {
    return { ok: false, count: 0, error: 'הפרויקט לא נמצא' };
  }

  const result = await db.task.updateMany({
    where: { id: { in: owned } },
    // The section belongs to the old project, so it cannot survive the move.
    data: { projectId, sectionId: null, assigneeId: null, ...(projectId === null ? { userId: user.id } : {}) },
  });

  refresh();
  return { ok: true, count: result.count };
}

export async function bulkDeleteAction(ids: string[]): Promise<BulkResult> {
  const user = await requireUser();
  if (!ids.length) return { ok: true, count: 0 };

  const result = await db.task.deleteMany({
    where: { id: { in: ids }, ...(await visibleTasks(user.id)) },
  });
  refresh();
  return { ok: true, count: result.count };
}
