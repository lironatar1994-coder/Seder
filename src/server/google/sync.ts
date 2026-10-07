import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { today, addDays } from '../../lib/dates';
import { externalEvent, type GoogleEvent } from '../../lib/google-calendar';
import { GoogleError, googleConfigured, googleRequest } from './client';

export function calendarTaskWhere(userId: string): Prisma.TaskWhereInput {
  return {
    parentId: null, status: { in: ['TODO', 'DONE'] },
    OR: [
      { userId, projectId: null },
      { project: { userId, archivedAt: null, members: { none: {} } } },
      { assigneeId: userId, project: { archivedAt: null, OR: [{ userId }, { members: { some: { userId } } }] } },
    ],
  };
}
export interface GoogleCalendarListEntry { id: string; summary: string; primary?: boolean; deleted?: boolean; }
interface EventPage { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string; }

export async function claimConnection(id: string) {
  const owner = randomUUID();
  const claim = await db.googleCalendarConnection.updateMany({ where: { id, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { leaseOwner: owner, leaseUntil: new Date(Date.now() + 5 * 60_000) } });
  return claim.count === 1 ? owner : null;
}
export async function releaseConnection(id: string, owner: string) {
  await db.googleCalendarConnection.updateMany({ where: { id, leaseOwner: owner }, data: { leaseOwner: null, leaseUntil: null } });
}

async function calendarList(connectionId: string) {
  const items: GoogleCalendarListEntry[] = []; let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ maxResults: '250', ...(pageToken ? { pageToken } : {}) });
    const result = await googleRequest<{ items?: GoogleCalendarListEntry[]; nextPageToken?: string }>(connectionId, `users/me/calendarList?${params}`);
    items.push(...(result.items ?? [])); pageToken = result.nextPageToken;
    if (!pageToken) return items.filter(item => !item.deleted);
  }
  throw new Error('CALENDAR_LIMIT');
}
async function listEvents(connectionId: string, calendarId: string, query: Record<string, string>) {
  let pageToken: string | undefined; const items: GoogleEvent[] = []; let nextSyncToken: string | undefined;
  for (let page = 0; page < 40; page++) {
    const params = new URLSearchParams({ maxResults: '250', ...query, ...(pageToken ? { pageToken } : {}) });
    const result = await googleRequest<EventPage>(connectionId, `calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    items.push(...(result.items ?? [])); pageToken = result.nextPageToken; nextSyncToken = result.nextSyncToken;
    if (!pageToken) return { items, nextSyncToken };
  }
  // Never silently commit a partial snapshot or remove omitted events.
  throw new Error('EVENT_LIMIT');
}
export async function syncGoogleCalendar(connectionId: string) {
  if (!googleConfigured()) return { ok: false, error: 'NOT_CONFIGURED' };
  const owner = await claimConnection(connectionId);
  if (!owner) return { ok: false, error: 'BUSY' };
  async function renew() {
    const result = await db.googleCalendarConnection.updateMany({ where: { id: connectionId, leaseOwner: owner }, data: { leaseUntil: new Date(Date.now() + 5 * 60_000) } });
    if (result.count !== 1) throw new Error('LEASE_LOST');
  }
  try {
    const connection = await db.googleCalendarConnection.findUniqueOrThrow({ where: { id: connectionId } });
    const sources = await calendarList(connectionId);
    for (const calendar of sources) {
      await db.googleCalendarSource.upsert({ where: { connectionId_googleId: { connectionId, googleId: calendar.id } }, create: { connectionId, googleId: calendar.id, name: calendar.summary.slice(0, 300), enabled: Boolean(calendar.primary) }, update: { name: calendar.summary.slice(0, 300) } });
    }
    await db.googleCalendarSource.deleteMany({ where: { connectionId, googleId: { notIn: sources.map(source => source.id) } } });
    if (connection.showEvents) {
      const enabled = await db.googleCalendarSource.findMany({ where: { connectionId, enabled: true }, take: 20 });
      for (const source of enabled) {
        await renew();
        let snapshot;
        try { snapshot = await listEvents(connectionId, source.googleId, { singleEvents: 'true', timeMin: addDays(today(), -31).toISOString(), timeMax: addDays(today(), 366).toISOString() }); }
        catch (error) {
          if (error instanceof GoogleError && [403, 404].includes(error.status)) { await db.googleCalendarSource.delete({ where: { id: source.id } }); continue; }
          throw error;
        }
        const events = snapshot.items.map(externalEvent).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        await db.$transaction(async tx => {
          await tx.googleCalendarEvent.deleteMany({ where: { sourceId: source.id } });
          if (events.length) await tx.googleCalendarEvent.createMany({ data: events.map(event => ({ sourceId: source.id, ...event })) });
        }, { timeout: 30_000 });
      }
    }
    await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { lastSyncAt: new Date(), lastError: null } });
    return { ok: true };
  } catch (error) {
    const code = error instanceof GoogleError && ['RECONNECT', 'PERMISSIONS'].includes(error.reason) ? error.reason : 'SYNC_FAILED';
    await db.googleCalendarConnection.updateMany({ where: { id: connectionId }, data: { lastError: code } });
    console.warn(JSON.stringify({ event: 'calendar.sync.failed', code }));
    return { ok: false, error: code };
  } finally { await releaseConnection(connectionId, owner); }
}
