import 'server-only';
import { db } from '@/server/db';
import { today, addDays, dayStartInstant, toDayStart } from '@/lib/dates';
import type { Priority, ViewSlug, WhenBucket } from '@/lib/constants';

/** One projection for every task the client renders, so the shape is identical
 *  whichever view produced it. Exported so search returns the same shape. */
export const TASK_SELECT = {
  id: true,
  title: true,
  notes: true,
  priority: true,
  status: true,
  whenBucket: true,
  scheduledFor: true,
  scheduledTime: true,
  deadline: true,
  completedAt: true,
  recurrence: true,
  position: true,
  projectId: true,
  sectionId: true,
  parentId: true,
  project: { select: { id: true, name: true, color: true } },
  labels: { select: { label: { select: { id: true, name: true, color: true } } } },
  subtasks: {
    select: { id: true, title: true, status: true, position: true },
    orderBy: { position: 'asc' },
  },
} as const;

export interface TaskDTO {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  status: string;
  whenBucket: WhenBucket;
  scheduledFor: Date | null;
  scheduledTime: string | null;
  deadline: Date | null;
  completedAt: Date | null;
  /** Serialised repeat rule, or null. See lib/recurrence.ts. */
  recurrence: string | null;
  position: string;
  projectId: string | null;
  sectionId: string | null;
  parentId: string | null;
  project: { id: string; name: string; color: string } | null;
  labels: { id: string; name: string; color: string }[];
  subtasks: { id: string; title: string; status: string; position: string }[];
}

type RawTask = Awaited<ReturnType<typeof db.task.findMany<{ select: typeof TASK_SELECT }>>>[number];

export function toDTO(task: RawTask): TaskDTO {
  return {
    ...task,
    priority: task.priority as Priority,
    whenBucket: task.whenBucket as WhenBucket,
    labels: task.labels.map((l) => l.label),
  };
}

/** Top-level only: a checklist item belongs under its parent, not loose in a
 *  view. */
const TOP_LEVEL = { parentId: null };

export interface TaskGroup {
  /** Stable key for React and for drop targets. */
  key: string;
  /** Group heading, or null for the leading ungrouped block. */
  title: string | null;
  subtitle?: string | null;
  tasks: TaskDTO[];
}

export interface ViewData {
  groups: TaskGroup[];
  /** Today's progress, for the day rail. Only populated for the today view. */
  progress?: { done: number; total: number };
}

export async function getViewTasks(userId: string, view: ViewSlug): Promise<ViewData> {
  const base = today();

  switch (view) {
    case 'today': {
      const [open, doneToday] = await Promise.all([
        db.task.findMany({
          where: {
            userId,
            ...TOP_LEVEL,
            status: 'TODO',
            OR: [{ scheduledFor: { lte: base } }, { deadline: { lte: base } }],
          },
          select: TASK_SELECT,
          orderBy: [{ priority: 'asc' }, { position: 'asc' }],
        }),
        db.task.count({
          where: {
            userId,
            ...TOP_LEVEL,
            status: { not: 'TODO' },
            // `completedAt` is a real timestamp, so it is compared against the
            // instant the Israeli day began — not against the UTC-midnight
            // label used for calendar dates, which is three hours later.
            completedAt: { gte: dayStartInstant(base) },
          },
        }),
      ]);

      const tasks = open.map(toDTO);
      // Anything still open from a previous day is separated out — it needs a
      // decision, not another silent day at the bottom of the list.
      const overdue = tasks.filter(
        (t) =>
          (t.scheduledFor && t.scheduledFor.getTime() < base.getTime()) ||
          (t.deadline && t.deadline.getTime() < base.getTime()),
      );
      const overdueIds = new Set(overdue.map((t) => t.id));
      const rest = tasks.filter((t) => !overdueIds.has(t.id));

      const groups: TaskGroup[] = [];
      if (overdue.length) {
        groups.push({
          key: 'overdue',
          title: 'נגרר מקודם',
          subtitle: 'להזיז להיום או לדחות',
          tasks: overdue,
        });
      }
      groups.push({ key: 'today', title: overdue.length ? 'היום' : null, tasks: rest });

      return { groups, progress: { done: doneToday, total: doneToday + tasks.length } };
    }

    case 'upcoming': {
      const horizon = addDays(base, 30);
      const rows = await db.task.findMany({
        where: {
          userId,
          ...TOP_LEVEL,
          status: 'TODO',
          scheduledFor: { gt: base, lte: horizon },
        },
        select: TASK_SELECT,
        orderBy: [{ scheduledFor: 'asc' }, { scheduledTime: 'asc' }, { position: 'asc' }],
      });

      // Group by calendar day; the header renders the weekday and date.
      const byDay = new Map<string, TaskDTO[]>();
      for (const row of rows) {
        const dto = toDTO(row);
        const key = dto.scheduledFor!.toISOString().slice(0, 10);
        const bucket = byDay.get(key);
        if (bucket) bucket.push(dto);
        else byDay.set(key, [dto]);
      }

      return {
        groups: [...byDay.entries()].map(([key, tasks]) => ({ key, title: key, tasks })),
      };
    }

    case 'inbox': {
      // The Inbox is a *place*, not a date: everything not yet filed into a
      // project, whether or not it is scheduled. A task added for tomorrow and
      // never filed belongs both here and in "בקרוב".
      const rows = await db.task.findMany({
        where: { userId, ...TOP_LEVEL, status: 'TODO', projectId: null },
        select: TASK_SELECT,
        orderBy: [{ position: 'asc' }],
      });
      return { groups: [{ key: view, title: null, tasks: rows.map(toDTO) }] };
    }

    case 'anytime': {
      // Filed, undated and ready. Unfiled work stays in the Inbox until it is
      // sorted, so the two views never say the same thing twice.
      const rows = await db.task.findMany({
        where: {
          userId,
          ...TOP_LEVEL,
          status: 'TODO',
          whenBucket: 'ANYTIME',
          projectId: { not: null },
        },
        select: TASK_SELECT,
        orderBy: [{ position: 'asc' }],
      });
      return { groups: [{ key: view, title: null, tasks: rows.map(toDTO) }] };
    }

    case 'someday': {
      // Deferring is an explicit decision, so it holds whether or not the task
      // has been filed.
      const rows = await db.task.findMany({
        where: { userId, ...TOP_LEVEL, status: 'TODO', whenBucket: 'SOMEDAY' },
        select: TASK_SELECT,
        orderBy: [{ position: 'asc' }],
      });
      return { groups: [{ key: view, title: null, tasks: rows.map(toDTO) }] };
    }

    case 'logbook': {
      // The logbook has its own page component so it can paginate; this branch
      // only exists to satisfy the exhaustive switch.
      const page = await getLogbookPage(userId);
      return { groups: groupByCompletionDay(page.tasks) };
    }
  }
}

/* ------------------------------------------------------------------ logbook */

export const LOGBOOK_PAGE_SIZE = 50;

export interface LogbookPage {
  tasks: TaskDTO[];
  /** Pass back to fetch the next page; null when the history is exhausted. */
  nextCursor: string | null;
}

/**
 * One page of completed tasks, newest first.
 *
 * Keyset pagination rather than offset: the cursor is the last row's
 * `completedAt` and id, so completing something new while the user is reading
 * cannot shift the window and make an entry appear twice or not at all.
 */
export async function getLogbookPage(userId: string, cursor?: string): Promise<LogbookPage> {
  const decoded = decodeCursor(cursor);

  const rows = await db.task.findMany({
    where: {
      userId,
      ...TOP_LEVEL,
      status: { not: 'TODO' },
      ...(decoded
        ? {
            OR: [
              { completedAt: { lt: decoded.completedAt } },
              // Same instant: fall back to the id so the order is total.
              { completedAt: decoded.completedAt, id: { lt: decoded.id } },
            ],
          }
        : {}),
    },
    select: TASK_SELECT,
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    // One extra row tells us whether there is another page, without a count().
    take: LOGBOOK_PAGE_SIZE + 1,
  });

  const hasMore = rows.length > LOGBOOK_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, LOGBOOK_PAGE_SIZE) : rows;
  const last = page.at(-1);

  return {
    tasks: page.map(toDTO),
    nextCursor: hasMore && last?.completedAt ? encodeCursor(last.completedAt, last.id) : null,
  };
}

function encodeCursor(completedAt: Date, id: string): string {
  return `${completedAt.toISOString()}|${id}`;
}

function decodeCursor(cursor?: string): { completedAt: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = cursor.split('|');
  const completedAt = new Date(iso);
  if (!id || Number.isNaN(completedAt.getTime())) return null;
  return { completedAt, id };
}

/** Groups completed tasks by the day they were finished. The keys are ISO days,
 *  which the list renders with its existing day-heading formatting. */
export function groupByCompletionDay(tasks: TaskDTO[]): TaskGroup[] {
  const byDay = new Map<string, TaskDTO[]>();

  for (const task of tasks) {
    // A task can only reach the logbook by being completed, but guard anyway
    // rather than crash on a row with a null timestamp.
    const key = task.completedAt ? toDayStart(task.completedAt).toISOString().slice(0, 10) : 'ללא';
    const bucket = byDay.get(key);
    if (bucket) bucket.push(task);
    else byDay.set(key, [task]);
  }

  return [...byDay.entries()].map(([key, dayTasks]) => ({ key, title: key, tasks: dayTasks }));
}

/** A project view keeps its sections as groups, with loose tasks on top. */
export async function getProjectView(userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      name: true,
      color: true,
      sections: { select: { id: true, name: true, position: true }, orderBy: { position: 'asc' } },
    },
  });
  if (!project) return null;

  const rows = await db.task.findMany({
    where: { userId, projectId, ...TOP_LEVEL, status: 'TODO' },
    select: TASK_SELECT,
    orderBy: [{ position: 'asc' }],
  });
  const tasks = rows.map(toDTO);

  const groups: TaskGroup[] = [
    { key: 'loose', title: null, tasks: tasks.filter((t) => !t.sectionId) },
    ...project.sections.map((section) => ({
      key: section.id,
      title: section.name,
      tasks: tasks.filter((t) => t.sectionId === section.id),
    })),
  ];

  const doneCount = await db.task.count({
    where: { userId, projectId, ...TOP_LEVEL, status: { not: 'TODO' } },
  });

  return { project, groups, progress: { done: doneCount, total: doneCount + tasks.length } };
}

export async function getLabelView(userId: string, labelId: string) {
  const label = await db.label.findFirst({
    where: { id: labelId, userId },
    select: { id: true, name: true, color: true },
  });
  if (!label) return null;

  const rows = await db.task.findMany({
    where: { userId, ...TOP_LEVEL, status: 'TODO', labels: { some: { labelId } } },
    select: TASK_SELECT,
    orderBy: [{ position: 'asc' }],
  });

  return { label, groups: [{ key: 'label', title: null, tasks: rows.map(toDTO) }] };
}

/**
 * One placement of a task on one day.
 *
 * A task can appear twice in a range: once on the day it is scheduled for, and
 * once on its deadline. Keeping them as separate entries is what lets the grid
 * show "work on it Tuesday, due Thursday" as two marks instead of collapsing
 * the app's one real differentiator back into a single date.
 */
export interface CalendarEntry {
  /** Unique per placement, not per task — a task with both dates yields two. */
  key: string;
  taskId: string;
  kind: 'scheduled' | 'deadline';
  iso: string;
  /** "HH:mm" on timed scheduled entries, else null. Drives ordering. */
  time: string | null;
  task: TaskDTO;
}

export interface CalendarData {
  /** Keyed by "YYYY-MM-DD". Days with nothing on them are simply absent. */
  entriesByDay: Record<string, CalendarEntry[]>;
  total: number;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getCalendarView(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<CalendarData> {
  const from = new Date(`${fromISO}T00:00:00.000Z`);
  const to = new Date(`${toISO}T00:00:00.000Z`);

  const rows = await db.task.findMany({
    where: {
      userId,
      ...TOP_LEVEL,
      OR: [
        { scheduledFor: { gte: from, lte: to } },
        { deadline: { gte: from, lte: to } },
      ],
    },
    select: TASK_SELECT,
    orderBy: [{ scheduledTime: 'asc' }, { priority: 'asc' }, { position: 'asc' }],
  });

  const entriesByDay: Record<string, CalendarEntry[]> = {};
  let total = 0;

  const place = (entry: CalendarEntry) => {
    (entriesByDay[entry.iso] ??= []).push(entry);
    total += 1;
  };

  for (const row of rows) {
    const task = toDTO(row);

    if (task.scheduledFor && task.scheduledFor >= from && task.scheduledFor <= to) {
      place({
        key: `${task.id}:scheduled`,
        taskId: task.id,
        kind: 'scheduled',
        iso: dayKey(task.scheduledFor),
        time: task.scheduledTime,
        task,
      });
    }

    if (task.deadline && task.deadline >= from && task.deadline <= to) {
      place({
        key: `${task.id}:deadline`,
        taskId: task.id,
        kind: 'deadline',
        iso: dayKey(task.deadline),
        time: null,
        task,
      });
    }
  }

  // Within a day: timed items first in clock order, then untimed, deadlines
  // last — a deadline is a marker about the day, not work to do in it.
  for (const list of Object.values(entriesByDay)) {
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'scheduled' ? -1 : 1;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return a.task.priority - b.task.priority;
    });
  }

  return { entriesByDay, total };
}

export interface SidebarData {
  projects: { id: string; name: string; color: string; openCount: number }[];
  labels: { id: string; name: string; color: string }[];
  counts: Record<ViewSlug, number>;
}

/** One pass for the whole sidebar — six separate count queries per navigation
 *  would be six round trips on every page. */
export async function getSidebarData(userId: string): Promise<SidebarData> {
  const base = today();
  const horizon = addDays(base, 30);

  const [projects, labels, grouped, todayCount, upcomingCount, inboxCount] = await Promise.all([
    db.project.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, name: true, color: true },
      orderBy: [{ position: 'asc' }],
    }),
    db.label.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { position: 'asc' },
    }),
    db.task.groupBy({
      by: ['whenBucket', 'projectId'],
      where: { userId, parentId: null, status: 'TODO' },
      _count: { _all: true },
    }),
    db.task.count({
      where: {
        userId,
        parentId: null,
        status: 'TODO',
        OR: [{ scheduledFor: { lte: base } }, { deadline: { lte: base } }],
      },
    }),
    db.task.count({
      where: { userId, parentId: null, status: 'TODO', scheduledFor: { gt: base, lte: horizon } },
    }),
    db.task.count({ where: { userId, parentId: null, status: 'TODO', projectId: null } }),
  ]);

  const sumBucket = (bucket: WhenBucket, filedOnly = false) =>
    grouped
      .filter((g) => g.whenBucket === bucket && (!filedOnly || g.projectId !== null))
      .reduce((n, g) => n + g._count._all, 0);

  const perProject = new Map<string, number>();
  for (const row of grouped) {
    if (!row.projectId) continue;
    perProject.set(row.projectId, (perProject.get(row.projectId) ?? 0) + row._count._all);
  }

  return {
    projects: projects.map((p) => ({ ...p, openCount: perProject.get(p.id) ?? 0 })),
    labels,
    counts: {
      inbox: inboxCount,
      today: todayCount,
      upcoming: upcomingCount,
      anytime: sumBucket('ANYTIME', true),
      someday: sumBucket('SOMEDAY'),
      logbook: 0,
    },
  };
}
