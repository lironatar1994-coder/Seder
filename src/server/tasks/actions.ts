'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { requireUser } from '@/server/auth/session';
import { parseQuickAdd } from '@/lib/quick-add-parser';
import { nextOccurrence, parseRecurrence } from '@/lib/recurrence';
import { relativeDayLabel, today, toDayStart } from '@/lib/dates';
import { keyBeforeFirst, keyAfterLast, keyBetween } from '@/lib/ordering';
import { titleSchema, updateTaskSchema, fieldErrors } from '@/lib/validation';
import {
  TASK_SELECT,
  getLogbookPage,
  toDTO,
  type LogbookPage,
  type TaskDTO,
} from '@/server/tasks/queries';
import type { Priority, WhenBucket } from '@/lib/constants';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface QuickAddResult extends ActionResult {
  /** Where the task actually landed, so the composer can say so — a task added
   *  from Today but scheduled for next week otherwise vanishes with no trace. */
  landedIn?: string;
}

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

/** Resolves a `#project` or `@label` name to an id, creating it if new, so a
 *  quick-add never silently drops what was typed. */
async function resolveProject(userId: string, name: string): Promise<string> {
  const existing = await db.project.findFirst({
    where: { userId, name: { equals: name } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const siblings = await db.project.findMany({
    where: { userId },
    select: { position: true },
    orderBy: { position: 'asc' },
  });
  const created = await db.project.create({
    data: { userId, name, position: keyAfterLast(siblings), color: 'teal' },
    select: { id: true },
  });
  return created.id;
}

async function resolveLabels(userId: string, names: string[]): Promise<string[]> {
  if (!names.length) return [];
  const existing = await db.label.findMany({
    where: { userId, name: { in: names } },
    select: { id: true, name: true },
  });
  const found = new Map(existing.map((l) => [l.name, l.id]));
  const missing = names.filter((n) => !found.has(n));

  if (missing.length) {
    const siblings = await db.label.findMany({
      where: { userId },
      select: { position: true },
      orderBy: { position: 'asc' },
    });
    let cursor = keyAfterLast(siblings);
    for (const name of missing) {
      const created = await db.label.create({
        data: { userId, name, position: cursor, color: 'slate' },
        select: { id: true },
      });
      found.set(name, created.id);
      cursor = keyBetween(cursor, null);
    }
  }

  return names.map((n) => found.get(n)!).filter(Boolean);
}

export interface QuickAddContext {
  /** The view the composer was opened from — decides where an undated task
   *  lands when the text carries no scheduling of its own. */
  view?: string;
  projectId?: string | null;
  sectionId?: string | null;
  /** "YYYY-MM-DD". Set by the calendar's day panel: adding from inside a day
   *  means that day, unless the text says otherwise. */
  defaultDate?: string | null;
}

/**
 * Where a freshly created task will actually be found.
 *
 * Filing and scheduling are separate axes, so an unfiled task with a date lands
 * in two places. The message names the dated view, since that is the one the
 * user was thinking about, and adds the Inbox when it applies.
 */
function landingView(
  bucket: WhenBucket,
  scheduledFor: Date | null,
  projectId: string | null,
): string {
  const unfiled = projectId === null;

  if (bucket === 'SCHEDULED' && scheduledFor) {
    const startOfToday = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const when = scheduledFor.getTime() <= startOfToday.getTime() ? 'היום' : 'בקרוב';
    return unfiled ? `${when} ולתיבה הנכנסת` : when;
  }

  if (bucket === 'SOMEDAY') return unfiled ? 'מתישהו ולתיבה הנכנסת' : 'מתישהו';
  return unfiled ? 'תיבה נכנסת' : 'בכל עת';
}

export async function quickAddAction(
  text: string,
  context: QuickAddContext = {},
): Promise<QuickAddResult> {
  const user = await requireUser();

  // The parser needs the existing names to match "#טיול ליוון" as one project
  // rather than stopping at the space and inventing "טיול".
  const [knownProjects, knownLabels] = await Promise.all([
    db.project.findMany({ where: { userId: user.id }, select: { name: true } }),
    db.label.findMany({ where: { userId: user.id }, select: { name: true } }),
  ]);

  const parsed = parseQuickAdd(text, new Date(), {
    projects: knownProjects.map((p) => p.name),
    labels: knownLabels.map((l) => l.name),
  });

  const titleCheck = titleSchema.safeParse(parsed.title);
  if (!titleCheck.success) {
    return { ok: false, error: fieldErrors(titleCheck.error)._ ?? 'לכל משימה צריך שם' };
  }

  // What the user typed always wins. Only when the text says nothing about
  // timing does the view they were looking at get to decide.
  let whenBucket: WhenBucket = parsed.whenBucket;
  let scheduledFor = parseDay(parsed.scheduledFor);
  const textCarriedTiming = Boolean(parsed.scheduledFor) || parsed.whenBucket !== 'ANYTIME';

  if (!textCarriedTiming) {
    if (context.defaultDate) {
      whenBucket = 'SCHEDULED';
      scheduledFor = parseDay(context.defaultDate);
    } else if (context.view === 'today') {
      whenBucket = 'SCHEDULED';
      scheduledFor = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    } else if (context.view === 'someday') {
      whenBucket = 'SOMEDAY';
    }
    // Everything else stays ANYTIME. Whether it shows in the Inbox or in
    // "בכל עת" follows from having a project, not from the bucket.
  }

  const projectId = parsed.projectName
    ? await resolveProject(user.id, parsed.projectName)
    : context.projectId ?? null;

  const labelIds = await resolveLabels(user.id, parsed.labelNames);

  const siblings = await db.task.findMany({
    where: { userId: user.id, parentId: null, status: 'TODO' },
    select: { position: true },
    orderBy: { position: 'asc' },
    take: 1,
  });

  const task = await db.task.create({
    data: {
      userId: user.id,
      title: titleCheck.data,
      priority: parsed.priority,
      whenBucket,
      scheduledFor,
      scheduledTime: parsed.scheduledTime,
      deadline: parseDay(parsed.deadline),
      recurrence: parsed.recurrence,
      projectId,
      sectionId: projectId === context.projectId ? context.sectionId ?? null : null,
      // New tasks land at the top — that is where you look for what you just
      // typed.
      position: keyBeforeFirst(siblings),
      labels: labelIds.length ? { create: labelIds.map((labelId) => ({ labelId })) } : undefined,
    },
    select: { id: true },
  });

  refresh();
  return { ok: true, id: task.id, landedIn: landingView(whenBucket, scheduledFor, projectId) };
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

export async function toggleTaskAction(id: string, done: boolean): Promise<ToggleResult> {
  const user = await requireUser();

  const task = await db.task.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      notes: true,
      priority: true,
      projectId: true,
      sectionId: true,
      recurrence: true,
      scheduledFor: true,
      scheduledTime: true,
      deadline: true,
      position: true,
      labels: { select: { labelId: true } },
    },
  });
  if (!task) return { ok: false, error: 'המשימה לא נמצאה' };

  const rule = done ? parseRecurrence(task.recurrence) : null;

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
        userId: user.id,
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
      where: { id },
      data: {
        whenBucket: 'SCHEDULED',
        scheduledFor: next,
        deadline: task.deadline ? new Date(task.deadline.getTime() + deadlineShift) : null,
      },
    });

    // The checklist starts over with the new occurrence.
    await db.task.updateMany({
      where: { parentId: id },
      data: { status: 'TODO', completedAt: null },
    });

    refresh();
    return {
      ok: true,
      repeat: {
        snapshotId: snapshot.id,
        previousDate: task.scheduledFor ? isoDay(task.scheduledFor) : null,
        nextDate: isoDay(next),
        nextLabel: relativeDayLabel(next, today()),
      },
    };
  }

  await db.task.update({
    where: { id },
    data: {
      status: done ? 'DONE' : 'TODO',
      completedAt: done ? new Date() : null,
    },
  });

  // Completing a parent closes its checklist too; reopening leaves the
  // checklist alone, since the user may only want the parent back.
  if (done) {
    await db.task.updateMany({
      where: { parentId: id, status: 'TODO' },
      data: { status: 'DONE', completedAt: new Date() },
    });
  }

  refresh();
  return { ok: true };
}

/** Reverses a repeat completion: bins the logged copy and rolls the live task
 *  back to the occurrence it was on. */
export async function undoRepeatAction(
  id: string,
  snapshotId: string,
  previousDate: string | null,
): Promise<ActionResult> {
  const user = await requireUser();

  const task = await db.task.findFirst({
    where: { id, userId: user.id },
    select: { id: true, deadline: true, scheduledFor: true },
  });
  if (!task) return { ok: false, error: 'המשימה לא נמצאה' };

  const restored = parseDay(previousDate);
  const shift =
    task.deadline && restored && task.scheduledFor
      ? restored.getTime() - toDayStart(task.scheduledFor).getTime()
      : 0;

  await db.task.deleteMany({
    where: { id: snapshotId, userId: user.id, recurrenceParentId: id },
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

  const owned = await db.task.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return { ok: false, error: 'המשימה לא נמצאה' };

  await db.task.update({
    where: { id },
    data: {
      ...rest,
      ...(scheduledFor !== undefined ? { scheduledFor: parseDay(scheduledFor) } : {}),
      ...(deadline !== undefined ? { deadline: parseDay(deadline) } : {}),
      ...(labelIds
        ? { labels: { deleteMany: {}, create: labelIds.map((labelId) => ({ labelId })) } }
        : {}),
    },
  });

  refresh();
  return { ok: true };
}

/** Schedule, or clear the schedule, from the row menu and the date popover. */
export async function scheduleTaskAction(
  id: string,
  when: { bucket: WhenBucket; date?: string | null; time?: string | null },
): Promise<ActionResult> {
  const user = await requireUser();
  const owned = await db.task.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return { ok: false, error: 'המשימה לא נמצאה' };

  const scheduled = when.bucket === 'SCHEDULED';
  await db.task.update({
    where: { id },
    data: {
      whenBucket: when.bucket,
      scheduledFor: scheduled ? parseDay(when.date) : null,
      scheduledTime: scheduled ? when.time ?? null : null,
    },
  });

  refresh();
  return { ok: true };
}

export async function setDeadlineAction(id: string, date: string | null): Promise<ActionResult> {
  const user = await requireUser();
  const owned = await db.task.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return { ok: false, error: 'המשימה לא נמצאה' };

  await db.task.update({ where: { id }, data: { deadline: parseDay(date) } });
  refresh();
  return { ok: true };
}

export async function setPriorityAction(id: string, priority: Priority): Promise<ActionResult> {
  const user = await requireUser();
  const owned = await db.task.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return { ok: false, error: 'המשימה לא נמצאה' };

  await db.task.update({ where: { id }, data: { priority } });
  refresh();
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const result = await db.task.deleteMany({ where: { id, userId: user.id } });
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
  const owned = await db.task.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return { ok: false, error: 'המשימה לא נמצאה' };

  const [before, after] = await Promise.all([
    beforeId
      ? db.task.findFirst({ where: { id: beforeId, userId: user.id }, select: { position: true } })
      : null,
    afterId
      ? db.task.findFirst({ where: { id: afterId, userId: user.id }, select: { position: true } })
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

  const parent = await db.task.findFirst({
    where: { id: parentId, userId: user.id },
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
export async function searchTasksAction(query: string): Promise<TaskDTO[]> {
  const user = await requireUser();
  const term = query.trim();
  if (term.length < 2) return [];

  const rows = await db.task.findMany({
    where: {
      userId: user.id,
      OR: [{ title: { contains: term } }, { notes: { contains: term } }],
    },
    select: TASK_SELECT,
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

export async function bulkCompleteAction(ids: string[]): Promise<ActionResult> {
  const user = await requireUser();
  if (!ids.length) return { ok: true };

  await db.task.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: { status: 'DONE', completedAt: new Date() },
  });

  refresh();
  return { ok: true };
}

export async function bulkDeleteAction(ids: string[]): Promise<ActionResult> {
  const user = await requireUser();
  if (!ids.length) return { ok: true };

  await db.task.deleteMany({ where: { id: { in: ids }, userId: user.id } });
  refresh();
  return { ok: true };
}
