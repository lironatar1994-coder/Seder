/**
 * Turning a line of text into a task, for any transport.
 *
 * This is deliberately *not* a server action and imports nothing from `next/`.
 * The web composer reaches it through `quickAddAction`, which adds the session
 * lookup and the cache revalidation; the WhatsApp worker — a plain Node process
 * with no request and no React — imports it directly.
 *
 * Keeping one implementation is the whole point. The obvious alternative is a
 * second parser on the messaging side, and then "מחר בשעה 14:30 #עבודה" means
 * one thing in the app and something slightly different over WhatsApp, forever.
 */

import { db } from '@/server/db';
import { parseQuickAdd } from '@/lib/quick-add-parser';
import { keyBeforeFirst, keyAfterLast, keyBetween } from '@/lib/ordering';
import { titleSchema, fieldErrors } from '@/lib/validation';
import { accessibleProjectIds, canUseProject } from '@/server/access';
import { today } from '@/lib/dates';
import type { WhenBucket } from '@/lib/constants';
import { quickAddSchedule, quickAddSelectionSchema, type QuickAddSelection } from '@/lib/quick-add-selection';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface QuickAddResult extends ActionResult {
  /** Where the task actually landed, so the composer can say so — a task added
   *  from Today but scheduled for next week otherwise vanishes with no trace. */
  landedIn?: string;
  /** What the parser understood, for a caller that wants to echo it back. The
   *  WhatsApp reply is built from this rather than from the raw text. */
  understood?: {
    title: string;
    scheduledFor: string | null;
    scheduledTime: string | null;
    deadline: string | null;
    projectName: string | null;
    labelNames: string[];
    priority: number;
    recurrence: string | null;
  };
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
  /** Explicit choices from the web composer. The server validates these and
   * checks project membership just as it does for a typed project name. */
  selection?: QuickAddSelection;
}

function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
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
    const startOfToday = today();
    const when = scheduledFor.getTime() <= startOfToday.getTime() ? 'היום' : 'בקרוב';
    return unfiled ? `${when} ולתיבה הנכנסת` : when;
  }

  if (bucket === 'SOMEDAY') return unfiled ? 'מתישהו ולתיבה הנכנסת' : 'מתישהו';
  return unfiled ? 'תיבה נכנסת' : 'בכל עת';
}

/** Resolves a `#project` or `@label` name to an id, creating it if new, so a
 *  quick-add never silently drops what was typed. */
async function resolveProject(userId: string, name: string): Promise<string> {
  // Matched against every project this user can reach, not only the ones they
  // own: typing "#עבודה" when עבודה is a project someone shared with them has
  // to file it *there*, not create a private second project with the same name.
  const existing = await db.project.findFirst({
    where: { id: { in: await accessibleProjectIds(userId) }, name: { equals: name } },
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

/**
 * Parse a line and create the task.
 *
 * Takes a userId rather than reading the session, because the caller is not
 * always a request: over WhatsApp the "session" is a phone number that matched
 * an account, and that lookup belongs to the transport, not here.
 */
export async function captureTask(
  userId: string,
  text: string,
  context: QuickAddContext = {},
): Promise<QuickAddResult> {
  const selectionCheck = quickAddSelectionSchema.safeParse(context.selection ?? {});
  if (!selectionCheck.success) return { ok: false, error: Object.values(fieldErrors(selectionCheck.error))[0] };
  const selection = selectionCheck.data;
  // The parser needs the existing names to match "#טיול ליוון" as one project
  // rather than stopping at the space and inventing "טיול".
  const [knownProjects, knownLabels] = await Promise.all([
    // Shared projects included: "#עבודה" should file into the shared project
    // by that name, not quietly create a private second one beside it.
    db.project.findMany({
      where: { id: { in: await accessibleProjectIds(userId) } },
      select: { id: true, name: true },
    }),
    db.label.findMany({ where: { userId }, select: { name: true } }),
  ]);

  const parsed = parseQuickAdd(text, new Date(), {
    projects: knownProjects.map((p) => p.name),
    labels: knownLabels.map((l) => l.name),
  });

  const titleCheck = titleSchema.safeParse(parsed.title);
  if (!titleCheck.success) {
    return { ok: false, error: fieldErrors(titleCheck.error)._ ?? 'לכל משימה צריך שם' };
  }

  const schedule = quickAddSchedule(parsed, context, selection);
  const whenBucket = schedule.bucket;
  const scheduledFor = parseDay(schedule.date);
  const deadline = selection.deadline !== undefined ? selection.deadline : parsed.deadline;
  const recurrence = selection.recurrence !== undefined ? selection.recurrence : parsed.recurrence;
  const priority = selection.priority ?? parsed.priority;
  const projectId = selection.projectId !== undefined ? selection.projectId : parsed.projectName
    ? await resolveProject(userId, parsed.projectName)
    : context.projectId ?? null;

  if (projectId && !(await canUseProject(userId, projectId))) return { ok: false, error: 'הפרויקט לא נמצא' };
  if (context.sectionId && projectId === context.projectId) {
    const section = projectId ? await db.section.findFirst({ where: { id: context.sectionId, projectId } }) : null;
    if (!section) return { ok: false, error: 'הקטע לא נמצא בפרויקט הזה' };
  }

  const labelNames = selection.labelNames ?? parsed.labelNames;
  const labelIds = await resolveLabels(userId, labelNames);

  const siblings = await db.task.findMany({
    where: { userId, parentId: null, status: 'TODO' },
    select: { position: true },
    orderBy: { position: 'asc' },
    take: 1,
  });

  const task = await db.task.create({
    data: {
      userId,
      title: titleCheck.data,
      priority,
      whenBucket,
      scheduledFor,
      scheduledTime: schedule.time,
      deadline: parseDay(deadline),
      recurrence,
      projectId,
      sectionId: projectId === context.projectId ? context.sectionId ?? null : null,
      // New tasks land at the top — that is where you look for what you just
      // typed.
      position: keyBeforeFirst(siblings),
      labels: labelIds.length ? { create: labelIds.map((labelId) => ({ labelId })) } : undefined,
    },
    select: { id: true },
  });

  return {
    ok: true,
    id: task.id,
    landedIn: landingView(whenBucket, scheduledFor, projectId),
    understood: {
      title: titleCheck.data,
      // Report what was *stored*, not what the text said: the view context can
      // have supplied a date the message never mentioned.
      scheduledFor: scheduledFor ? scheduledFor.toISOString().slice(0, 10) : null,
      scheduledTime: schedule.time,
      deadline: deadline ?? null,
      projectName: projectId ? knownProjects.find(project => project.id === projectId)?.name ?? parsed.projectName : null,
      labelNames,
      priority,
      recurrence,
    },
  };
}
