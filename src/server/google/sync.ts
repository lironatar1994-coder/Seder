import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { today, addDays } from '../../lib/dates';
import { externalEvent, googleEventToTask, taskEventId, taskFingerprint, taskToGoogleEvent, type GoogleEvent } from '../../lib/google-calendar';
import { APP_URL, GoogleError, googleConfigured, googleRequest } from './client';

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
  let pendingWrites = false;
  async function renew() {
    const result = await db.googleCalendarConnection.updateMany({ where: { id: connectionId, leaseOwner: owner }, data: { leaseUntil: new Date(Date.now() + 5 * 60_000) } });
    if (result.count !== 1) throw new Error('LEASE_LOST');
  }
  try {
    let connection = await db.googleCalendarConnection.findUniqueOrThrow({ where: { id: connectionId } });
    const sources = await calendarList(connectionId);
    for (const calendar of sources) {
      if (calendar.id === connection.taskCalendarId) continue;
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
    // Create a separate calendar. No writes ever target a personal calendar.
    if (!connection.taskCalendarId && connection.syncTasks) {
      const calendar = await googleRequest<{ id: string }>(connectionId, 'calendars', { method: 'POST', body: { summary: 'סדר', description: 'משימות מתוזמנות מסדר', timeZone: 'Asia/Jerusalem' } });
      connection = await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { taskCalendarId: calendar.id, taskSyncToken: null } });
    }
    if (connection.taskCalendarId) {
      const calendarId = connection.taskCalendarId;
      const eventPath = (id: string) => `calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`;
      let snapshot;
      try { snapshot = await listEvents(connectionId, calendarId, { singleEvents: 'false', showDeleted: 'true', ...(connection.taskSyncToken ? { syncToken: connection.taskSyncToken } : {}) }); }
      catch (error) {
        if (error instanceof GoogleError && error.status === 410) {
          await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { taskSyncToken: null } });
          snapshot = await listEvents(connectionId, calendarId, { singleEvents: 'false', showDeleted: 'true' });
        } else if (error instanceof GoogleError && error.status === 404) {
          await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { taskCalendarId: null, taskSyncToken: null } });
          await db.googleTaskLink.deleteMany({ where: { connectionId } });
          throw new Error('CALENDAR_REMOVED');
        } else throw error;
      }
      if (connection.syncTasks) for (const event of snapshot.items) {
        await renew();
        const link = await db.googleTaskLink.findUnique({ where: { connectionId_eventId: { connectionId, eventId: event.id } }, include: { task: true } });
        if (!link?.task) continue;
        const task = await db.task.findFirst({ where: { ...calendarTaskWhere(connection.userId), id: link.task.id } });
        // Access/assignment is checked again before importing. Local edits win
        // when both sides changed since the previous successful export.
        if (!task || task.updatedAt.getTime() !== link.taskUpdatedAt.getTime() || task.status !== 'TODO') continue;
        if (event.status === 'cancelled') {
          await db.task.updateMany({ where: { ...calendarTaskWhere(connection.userId), id: task.id, updatedAt: task.updatedAt }, data: { whenBucket: 'ANYTIME', scheduledFor: null, scheduledTime: null, remindedAt: null } });
          continue;
        }
        const imported = googleEventToTask(event, task);
        if (!imported || taskFingerprint(imported) === link.fingerprint) continue;
        await db.task.updateMany({ where: { ...calendarTaskWhere(connection.userId), id: task.id, updatedAt: task.updatedAt }, data: { title: imported.title, notes: imported.notes, scheduledFor: imported.scheduledFor, scheduledTime: imported.scheduledTime, durationMinutes: imported.durationMinutes, whenBucket: 'SCHEDULED', remindedAt: null } });
      }
      const tasks = connection.syncTasks ? await db.task.findMany({ where: { ...calendarTaskWhere(connection.userId), whenBucket: 'SCHEDULED', scheduledFor: { gte: addDays(today(), -31), lte: addDays(today(), 365) }, ...(connection.syncAllDay ? {} : { scheduledTime: { not: null } }) }, orderBy: [{ updatedAt: 'asc' }] }) : [];
      const wanted = new Set(tasks.map(task => task.id));
      const links = await db.googleTaskLink.findMany({ where: { connectionId } });
      for (const link of links) {
        await renew();
        if (link.taskId && wanted.has(link.taskId)) continue;
        try { await googleRequest(connectionId, eventPath(link.eventId), { method: 'DELETE' }); }
        catch (error) { if (!(error instanceof GoogleError && [404, 410].includes(error.status))) throw error; }
        await db.googleTaskLink.delete({ where: { id: link.id } });
      }
      const indexed = new Map(links.map(link => [link.taskId, link]));
      let writes = 0;
      for (const task of tasks) {
        await renew();
        const fingerprint = taskFingerprint(task); const previous = indexed.get(task.id);
        if (previous?.fingerprint === fingerprint) {
          if (previous.taskUpdatedAt.getTime() !== task.updatedAt.getTime()) await db.googleTaskLink.update({ where: { id: previous.id }, data: { taskUpdatedAt: task.updatedAt } });
          continue;
        }
        // Pace initial exports across sweeps instead of flooding the provider.
        if (writes++ >= 100) { pendingWrites = true; break; }
        const currentTask = await db.task.findFirst({ where: { ...calendarTaskWhere(connection.userId), id: task.id, updatedAt: task.updatedAt } });
        if (!currentTask) continue;
        const payload = taskToGoogleEvent(task, APP_URL());
        let eventId = previous?.eventId ?? taskEventId(connectionId, task.id);
        if (previous) {
          try { await googleRequest(connectionId, eventPath(eventId), { method: 'PATCH', body: payload }); }
          catch (error) {
            if (!(error instanceof GoogleError && [404, 410].includes(error.status))) throw error;
            // Deleted events leave tombstones: use a fresh id for re-creation.
            eventId = taskEventId(connectionId, `${task.id}:revived:${task.updatedAt.toISOString()}`);
            await googleRequest(connectionId, `calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: { id: eventId, ...payload } });
          }
        } else {
          try { await googleRequest(connectionId, `calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: { id: eventId, ...payload } }); }
          catch (error) {
            if (!(error instanceof GoogleError && error.status === 409)) throw error;
            try { await googleRequest(connectionId, eventPath(eventId), { method: 'PATCH', body: payload }); }
            catch (patchError) {
              if (!(patchError instanceof GoogleError && [404, 410].includes(patchError.status))) throw patchError;
              eventId = taskEventId(connectionId, `${task.id}:revived:${task.updatedAt.toISOString()}`);
              try { await googleRequest(connectionId, `calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: { id: eventId, ...payload } }); }
              catch (insertError) { if (!(insertError instanceof GoogleError && insertError.status === 409)) throw insertError; await googleRequest(connectionId, eventPath(eventId), { method: 'PATCH', body: payload }); }
            }
          }
        }
        await db.googleTaskLink.upsert({ where: { connectionId_taskId: { connectionId, taskId: task.id } }, create: { connectionId, taskId: task.id, eventId, fingerprint, taskUpdatedAt: task.updatedAt }, update: { eventId, fingerprint, taskUpdatedAt: task.updatedAt } });
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { taskSyncToken: snapshot.nextSyncToken ?? null } });
    }
    await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { lastSyncAt: new Date(), lastError: null } });
    return pendingWrites ? { ok: true, warning: 'MORE_TASKS' } : { ok: true };
  } catch (error) {
    const code = error instanceof GoogleError && ['RECONNECT', 'PERMISSIONS'].includes(error.reason) ? error.reason : error instanceof Error && error.message === 'CALENDAR_REMOVED' ? 'CALENDAR_REMOVED' : 'SYNC_FAILED';
    await db.googleCalendarConnection.updateMany({ where: { id: connectionId }, data: { lastError: code } });
    console.warn(JSON.stringify({ event: 'calendar.sync.failed', code }));
    return { ok: false, error: code };
  } finally { await releaseConnection(connectionId, owner); }
}
