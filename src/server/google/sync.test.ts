import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { db } from '../db';
import { sealToken } from './crypto';
import { syncGoogleCalendar, claimConnection, releaseConnection, calendarTaskWhere } from './sync';
import { addDays, today } from '../../lib/dates';
import { externalEvent, type GoogleEvent } from '../../lib/google-calendar';

vi.mock('../db', async () => { const { PrismaClient } = await import('@prisma/client'); return { db: new PrismaClient({ datasourceUrl: 'file:./google-integration-test.db' }) }; });
let userId: string; let connectionId: string;
let events: Map<string, GoogleEvent>; let calls: { path: string; method: string }[];
let nextError = 0; let externalPages = false;
const managedId = 'seder-managed@group.calendar.google.com';
const calendarPath = `calendars/${encodeURIComponent(managedId)}/events`;
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
beforeAll(() => { if (!existsSync('prisma/google-integration-test.db')) writeFileSync('prisma/google-integration-test.db', ''); execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: 'file:./google-integration-test.db' }, stdio: 'pipe' }); });
beforeEach(async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'fake-client'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'fake-secret'); vi.stubEnv('GOOGLE_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 3).toString('base64')); vi.stubEnv('GOOGLE_CALENDAR_ENABLED', '1');
  events = new Map(); calls = []; nextError = 0; externalPages = false;
  const user = await db.user.create({ data: { name: 'Calendar test', email: `calendar-${crypto.randomUUID()}@seder.test`, passwordHash: 'unused' } }); userId = user.id;
  const connection = await db.googleCalendarConnection.create({ data: { userId, accountEmail: 'fake@gmail.com', refreshToken: sealToken('fake-refresh'), accessToken: sealToken('fake-access'), accessExpiresAt: new Date(Date.now() + 3600_000) } }); connectionId = connection.id;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'refreshed', expires_in: 3600 });
    const target = new URL(url); const path = target.pathname.replace('/calendar/v3/', ''); const method = init.method ?? 'GET'; calls.push({ path: path + target.search, method });
    if (nextError && path === calendarPath && target.searchParams.has('syncToken')) { const status = nextError; nextError = 0; return json({}, status); }
    if (path === 'users/me/calendarList') return json({ items: [{ id: 'primary@gmail.com', summary: 'יומן אישי', primary: true }, { id: managedId, summary: 'סדר' }] });
    if (path === 'calendars' && method === 'POST') return json({ id: managedId });
    if (path === 'calendars/primary%40gmail.com/events') {
      const day = today().toISOString().slice(0, 10); const nextDay = addDays(today(), 1).toISOString().slice(0, 10);
      return json({ items: [{ id: target.searchParams.has('pageToken') ? 'meeting2' : 'meeting1', summary: 'פגישה ביומן', start: { date: day }, end: { date: nextDay } }], ...(externalPages && !target.searchParams.has('pageToken') ? { nextPageToken: 'external-page-2' } : {}) });
    }
    if (path === calendarPath && method === 'GET') return json({ items: [...events.values()], nextSyncToken: 'next-sync-token' });
    if (path === calendarPath && method === 'POST') { const body = JSON.parse(init.body as string); if (events.has(body.id)) return json({}, 409); events.set(body.id, body); return json(body); }
    if (path.startsWith(calendarPath + '/')) {
      const id = path.slice(calendarPath.length + 1);
      if (method === 'DELETE') { if (!events.has(id)) return json({}, 404); events.set(id, { id, status: 'cancelled' }); return new Response(null, { status: 204 }); }
      if (method === 'PATCH') { if (!events.has(id) || events.get(id)?.status === 'cancelled') return json({}, 410); const body = { ...events.get(id), ...JSON.parse(init.body as string) }; events.set(id, body); return json(body); }
    }
    throw new Error(`Unexpected fake API request: ${path} ${method}`);
  }));
});
afterEach(async () => { await db.user.deleteMany({ where: { email: { endsWith: '@seder.test' }, name: { in: ['Calendar test', 'Calendar friend'] } } }); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterAll(async () => { await db.$disconnect(); });
async function task(extra: Record<string, unknown> = {}) { return db.task.create({ data: { userId, title: 'משימה ליומן', notes: 'הערה', whenBucket: 'SCHEDULED', scheduledFor: today(), scheduledTime: '09:30', durationMinutes: 45, position: 'a0', ...extra } }); }
describe('Google synchronization using an isolated database and provider', () => {
  it('creates a dedicated calendar, imports meetings, exports tasks and refreshes tokens', async () => {
    const row = await task(); await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { accessExpiresAt: new Date(0) } });
    expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: true });
    expect(await db.googleCalendarEvent.count()).toBe(1); const link = await db.googleTaskLink.findFirstOrThrow({ where: { taskId: row.id } });
    expect(events.get(link.eventId)?.summary).toBe(row.title); expect(events.get(link.eventId)?.end?.dateTime).toContain('07:15');
    expect(calls.some(call => call.path === 'calendars' && call.method === 'POST')).toBe(true);
    calls = []; expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: true }); expect(calls.some(call => call.path.includes('syncToken=next-sync-token'))).toBe(true); expect(calls.filter(call => ['POST', 'PATCH'].includes(call.method))).toHaveLength(0);
  });
  it('imports name, day, time and duration changes and lets concurrent local changes win', async () => {
    const row = await task(); await syncGoogleCalendar(connectionId); const link = await db.googleTaskLink.findFirstOrThrow({ where: { taskId: row.id } });
    events.set(link.eventId, { ...events.get(link.eventId)!, summary: 'שם מעודכן ב־Google', start: { dateTime: '2026-12-03T12:00:00+02:00' }, end: { dateTime: '2026-12-03T13:30:00+02:00' } });
    await syncGoogleCalendar(connectionId); expect(await db.task.findUnique({ where: { id: row.id } })).toMatchObject({ title: 'שם מעודכן ב־Google', scheduledFor: new Date('2026-12-03T00:00:00Z'), scheduledTime: '12:00', durationMinutes: 90 });
    await db.task.update({ where: { id: row.id }, data: { title: 'השינוי המקומי', updatedAt: new Date(Date.now() + 1000) } }); events.set(link.eventId, { ...events.get(link.eventId)!, summary: 'שינוי מתחרה' });
    await syncGoogleCalendar(connectionId); expect(events.get(link.eventId)?.summary).toBe('השינוי המקומי');
  });
  it('never exports unclaimed shared work or work assigned to another person', async () => {
    const friend = await db.user.create({ data: { name: 'Calendar friend', email: `friend-${crypto.randomUUID()}@seder.test`, passwordHash: 'unused' } });
    const project = await db.project.create({ data: { userId, name: 'Shared', position: 'a0', members: { create: { userId: friend.id } } } });
    await task({ projectId: project.id }); await task({ projectId: project.id, assigneeId: friend.id }); const mine = await task({ projectId: project.id, assigneeId: userId });
    await syncGoogleCalendar(connectionId); expect(await db.googleTaskLink.findMany({ where: { connectionId }, select: { taskId: true } })).toEqual([{ taskId: mine.id }]);
    await db.task.update({ where: { id: mine.id }, data: { assigneeId: friend.id } }); await syncGoogleCalendar(connectionId); expect(await db.googleTaskLink.count({ where: { connectionId } })).toBe(0);
    expect(await db.task.count({ where: calendarTaskWhere(friend.id) })).toBe(2);
  });
  it('marks completion, removes deleted task events, and unschedules Google deletions', async () => {
    const row = await task(); await syncGoogleCalendar(connectionId); const link = await db.googleTaskLink.findFirstOrThrow({ where: { taskId: row.id } });
    events.set(link.eventId, { id: link.eventId, status: 'cancelled' }); await syncGoogleCalendar(connectionId);
    expect(await db.task.findUnique({ where: { id: row.id } })).toMatchObject({ scheduledFor: null, whenBucket: 'ANYTIME', status: 'TODO' });
    await db.task.update({ where: { id: row.id }, data: { scheduledFor: today(), scheduledTime: null, whenBucket: 'SCHEDULED', status: 'DONE' } });
    await syncGoogleCalendar(connectionId); const completeLink = await db.googleTaskLink.findFirstOrThrow({ where: { taskId: row.id } }); expect(events.get(completeLink.eventId)?.summary).toBe('✔️ משימה ליומן');
    await db.task.delete({ where: { id: row.id } }); await syncGoogleCalendar(connectionId); expect(events.get(completeLink.eventId)?.status).toBe('cancelled'); expect(await db.googleTaskLink.count()).toBe(0);
  });
  it('handles pagination and invalid incremental tokens without losing events', async () => {
    externalPages = true; await task(); await syncGoogleCalendar(connectionId); expect(await db.googleCalendarEvent.count()).toBe(2);
    nextError = 410; expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: true }); expect(await db.googleCalendarEvent.count()).toBe(2);
    expect(calls.filter(call => call.path === calendarPath + '?maxResults=250&singleEvents=false&showDeleted=true').length).toBeGreaterThanOrEqual(2);
  });
  it('only removes its own mapped events when task synchronization is disabled', async () => {
    await task(); await syncGoogleCalendar(connectionId); events.set('manual-event', { id: 'manual-event', summary: 'אירוע ידני' });
    await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { syncTasks: false } }); await syncGoogleCalendar(connectionId); expect(events.get('manual-event')?.status).not.toBe('cancelled'); expect(await db.googleTaskLink.count()).toBe(0);
  });
  it('serializes manual and automatic sweeps and recovers an expired lease', async () => {
    const owner = await claimConnection(connectionId); expect(owner).toBeTruthy(); expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: false, error: 'BUSY' }); await releaseConnection(connectionId, 'other-owner'); expect(await claimConnection(connectionId)).toBeNull(); await releaseConnection(connectionId, owner!); expect(await claimConnection(connectionId)).toBeTruthy();
    await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { leaseUntil: new Date(0) } }); expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: true });
  });
  it('filters invalid external dates instead of creating corrupt cache rows', () => { expect(externalEvent({ id: 'bad', start: { dateTime: 'invalid' }, end: { dateTime: 'invalid' } })).toBeNull(); });
});
