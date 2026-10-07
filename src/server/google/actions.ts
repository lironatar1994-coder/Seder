'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '../auth/session';
import { db } from '../db';
import { APP_URL } from './client';
import { hashState } from './crypto';
import { claimConnection, releaseConnection, syncGoogleCalendar } from './sync';

function refresh() { revalidatePath('/app', 'layout'); }
export async function syncGoogleAction() {
  const user = await requireUser(); const connection = await db.googleCalendarConnection.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!connection) return { ok: false, error: 'NO_CONNECTION' };
  const result = await syncGoogleCalendar(connection.id); refresh(); return result;
}
export async function updateGoogleSettings(input: unknown) {
  const user = await requireUser();
  const parsed = z.object({ showEvents: z.boolean(), calendars: z.array(z.string().max(500)).max(20) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const connection = await db.googleCalendarConnection.findUnique({ where: { userId: user.id }, include: { sources: true } });
  if (!connection || parsed.data.calendars.some(id => !connection.sources.some(source => source.id === id))) return { ok: false, error: 'INVALID' };
  const owner = await claimConnection(connection.id); if (!owner) return { ok: false, error: 'BUSY' };
  try {
    const { calendars, ...settings } = parsed.data;
    await db.$transaction(async tx => {
      await tx.googleCalendarConnection.update({ where: { id: connection.id }, data: { ...settings, syncTasks: false, syncAllDay: false } });
      await tx.googleCalendarSource.updateMany({ where: { connectionId: connection.id }, data: { enabled: false } });
      await tx.googleCalendarSource.updateMany({ where: { connectionId: connection.id, id: { in: calendars } }, data: { enabled: true } });
    });
  } finally { await releaseConnection(connection.id, owner); }
  const result = await syncGoogleCalendar(connection.id); refresh();
  return { ok: true, warning: result.ok ? undefined : result.error };
}
export async function disconnectGoogleAction() {
  const user = await requireUser(); const connection = await db.googleCalendarConnection.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!connection) return { ok: true };
  const owner = await claimConnection(connection.id); if (!owner) return { ok: false, error: 'BUSY' };
  try { await db.googleCalendarConnection.delete({ where: { id: connection.id } }); } finally { await releaseConnection(connection.id, owner); }
  refresh(); return { ok: true };
}
export async function createCalendarFeedAction() {
  const user = await requireUser(); const token = randomBytes(32).toString('base64url');
  await db.calendarFeed.upsert({ where: { userId: user.id }, create: { userId: user.id, tokenHash: hashState(token) }, update: { tokenHash: hashState(token), createdAt: new Date() } });
  refresh(); return { url: `${APP_URL()}/api/calendar/feed/${token}` };
}
export async function revokeCalendarFeedAction() {
  const user = await requireUser(); await db.calendarFeed.deleteMany({ where: { userId: user.id } }); refresh(); return { ok: true };
}
