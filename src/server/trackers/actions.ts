'use server';

import { z } from 'zod';
import { db } from '@/server/db';
import { canUseProject } from '@/server/access';
import { requireUser } from '@/server/auth/session';
import { keyAfterLast } from '@/lib/ordering';
import { parseDayKey, serializeWeekdays, TRACKER_PERIODS } from '@/lib/tracker';
import type { ActionResult } from '@/server/tasks/actions';

/*
 * Habit tables are edited optimistically: the table on screen has already
 * changed by the time any of these run, so they write and answer, and never
 * revalidate. Re-rendering the project for every V would repaint the whole
 * page under the user's finger — exactly the flicker the table exists to avoid.
 * The next visit to the project reads everything fresh.
 */

const name = z.string().trim().min(1, 'לטבלה צריך שם').max(80, 'השם ארוך מדי');
const rowTitle = z.string().trim().min(1, 'לשורה צריך שם').max(120, 'השם ארוך מדי');
const settings = z.object({
  name,
  period: z.enum(TRACKER_PERIODS),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'צריך לבחור לפחות יום אחד').max(7),
});

const NOT_FOUND = { ok: false, error: 'הטבלה לא נמצאה' } as const;

async function trackerProject(userId: string, trackerId: string) {
  const tracker = await db.tracker.findUnique({ where: { id: trackerId }, select: { projectId: true } });
  return tracker && (await canUseProject(userId, tracker.projectId)) ? tracker.projectId : null;
}

async function rowTracker(userId: string, rowId: string) {
  const row = await db.trackerRow.findUnique({ where: { id: rowId }, select: { trackerId: true, tracker: { select: { projectId: true } } } });
  return row && (await canUseProject(userId, row.tracker.projectId)) ? row.trackerId : null;
}

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? 'הנתונים לא תקינים';
}

export async function createTrackerAction(projectId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await canUseProject(user.id, projectId))) return { ok: false, error: 'הפרויקט לא נמצא' };
  const parsed = settings.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const siblings = await db.tracker.findMany({ where: { projectId }, select: { position: true }, orderBy: { position: 'asc' } });
  const tracker = await db.tracker.create({
    data: {
      projectId,
      name: parsed.data.name,
      period: parsed.data.period,
      weekdays: serializeWeekdays(parsed.data.weekdays),
      position: keyAfterLast(siblings),
    },
    select: { id: true },
  });
  return { ok: true, id: tracker.id };
}

export async function updateTrackerAction(trackerId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await trackerProject(user.id, trackerId))) return NOT_FOUND;
  const parsed = settings.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await db.tracker.update({
    where: { id: trackerId },
    data: { name: parsed.data.name, period: parsed.data.period, weekdays: serializeWeekdays(parsed.data.weekdays) },
  });
  return { ok: true };
}

export async function deleteTrackerAction(trackerId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await trackerProject(user.id, trackerId))) return NOT_FOUND;
  await db.tracker.delete({ where: { id: trackerId } });
  return { ok: true };
}

export async function addTrackerRowAction(trackerId: string, title: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await trackerProject(user.id, trackerId))) return NOT_FOUND;
  const parsed = rowTitle.safeParse(title);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const siblings = await db.trackerRow.findMany({ where: { trackerId }, select: { position: true }, orderBy: { position: 'asc' } });
  const row = await db.trackerRow.create({
    data: { trackerId, title: parsed.data, position: keyAfterLast(siblings) },
    select: { id: true },
  });
  return { ok: true, id: row.id };
}

export async function renameTrackerRowAction(rowId: string, title: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await rowTracker(user.id, rowId))) return { ok: false, error: 'השורה לא נמצאה' };
  const parsed = rowTitle.safeParse(title);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await db.trackerRow.update({ where: { id: rowId }, data: { title: parsed.data } });
  return { ok: true };
}

export async function deleteTrackerRowAction(rowId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await rowTracker(user.id, rowId))) return { ok: false, error: 'השורה לא נמצאה' };
  await db.trackerRow.delete({ where: { id: rowId } });
  return { ok: true };
}

/**
 * Sets one cell. Idempotent on purpose — "checked" or "not checked", never
 * "flip" — so two quick taps that arrive out of order still end where the
 * last tap left the screen.
 */
export async function setTrackerCheckAction(rowId: string, day: string, checked: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const date = parseDayKey(day);
  if (!date) return { ok: false, error: 'תאריך לא תקין' };
  if (!(await rowTracker(user.id, rowId))) return { ok: false, error: 'השורה לא נמצאה' };
  if (checked) {
    await db.trackerCheck.upsert({ where: { rowId_day: { rowId, day: date } }, create: { rowId, day: date }, update: {} });
  } else {
    await db.trackerCheck.deleteMany({ where: { rowId, day: date } });
  }
  return { ok: true };
}

/** A note belongs to a V, so saving one also checks the cell. */
export async function setTrackerNoteAction(rowId: string, day: string, note: string): Promise<ActionResult> {
  const user = await requireUser();
  const date = parseDayKey(day);
  if (!date) return { ok: false, error: 'תאריך לא תקין' };
  if (!(await rowTracker(user.id, rowId))) return { ok: false, error: 'השורה לא נמצאה' };
  const text = note.trim().slice(0, 500) || null;
  await db.trackerCheck.upsert({ where: { rowId_day: { rowId, day: date } }, create: { rowId, day: date, note: text }, update: { note: text } });
  return { ok: true };
}
