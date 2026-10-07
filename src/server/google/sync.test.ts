import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { db } from '../db';
import { sealToken } from './crypto';
import { syncGoogleCalendar, claimConnection, releaseConnection } from './sync';
import { GOOGLE_SCOPES } from './client';
import { addDays, today } from '../../lib/dates';
import { externalEvent, type GoogleEvent } from '../../lib/google-calendar';

vi.mock('../db', async () => { const { PrismaClient } = await import('@prisma/client'); return { db: new PrismaClient({ datasourceUrl: 'file:./google-integration-test.db' }) }; });
let userId: string; let connectionId: string;
let events: GoogleEvent[]; let calls: { path: string; method: string }[];
let providerError = 0; let extraPage = false;
const primaryId = 'primary@gmail.com';
const eventPath = `calendars/${encodeURIComponent(primaryId)}/events`;
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
beforeAll(() => { if (!existsSync('prisma/google-integration-test.db')) writeFileSync('prisma/google-integration-test.db', ''); execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: 'file:./google-integration-test.db' }, stdio: 'pipe' }); });
beforeEach(async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'fake-client'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'fake-secret'); vi.stubEnv('GOOGLE_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 3).toString('base64')); vi.stubEnv('GOOGLE_CALENDAR_ENABLED', '1');
  const day = today().toISOString().slice(0, 10); const nextDay = addDays(today(), 1).toISOString().slice(0, 10);
  events = [{ id: 'meeting1', summary: 'פגישה ביומן', start: { date: day }, end: { date: nextDay } }];
  calls = []; providerError = 0; extraPage = false;
  const user = await db.user.create({ data: { name: 'Calendar test', email: `calendar-${crypto.randomUUID()}@seder.test`, passwordHash: 'unused' } }); userId = user.id;
  const connection = await db.googleCalendarConnection.create({ data: { userId, accountEmail: primaryId, refreshToken: sealToken('fake-refresh'), accessToken: sealToken('fake-access'), accessExpiresAt: new Date(Date.now() + 3600000) } }); connectionId = connection.id;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'refreshed', expires_in: 3600 });
    const target = new URL(url); const path = target.pathname.replace('/calendar/v3/', ''); const method = init.method ?? 'GET'; calls.push({ path: path + target.search, method });
    if (method !== 'GET' || init.body) throw new Error('Google calendar writes are forbidden');
    if (path === 'users/me/calendarList') return json({ items: [{ id: primaryId, summary: 'יומן אישי', primary: true }] });
    if (path === eventPath) {
      if (providerError) return json({}, providerError);
      if (target.searchParams.has('pageToken')) return json({ items: [{ ...events[0], id: 'meeting2' }] });
      return json({ items: events, ...(extraPage ? { nextPageToken: 'page-2' } : {}) });
    }
    throw new Error(`Unexpected provider request: ${path}`);
  }));
});
afterEach(async () => { await db.user.deleteMany({ where: { email: { endsWith: '@seder.test' }, name: 'Calendar test' } }); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterAll(async () => { await db.$disconnect(); });

describe('Google → Seder read-only import', () => {
  it('requests only the two read-only scopes', () => {
    expect(GOOGLE_SCOPES).toEqual(['https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly']);
  });
  it('imports meetings and refreshes tokens without creating a calendar or exporting tasks', async () => {
    const task = await db.task.create({ data: { userId, title: 'משימה מקומית', whenBucket: 'SCHEDULED', scheduledFor: today(), scheduledTime: '09:30', position: 'a0' } });
    await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { accessExpiresAt: new Date(0) } });
    expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: true });
    expect(await db.googleCalendarEvent.findMany({ where: { source: { connectionId } }, select: { title: true } })).toEqual([{ title: 'פגישה ביומן' }]);
    expect(await db.googleTaskLink.count({ where: { connectionId } })).toBe(0);
    expect(await db.googleCalendarConnection.findUnique({ where: { id: connectionId } })).toMatchObject({ taskCalendarId: null, lastError: null });
    expect(await db.task.findUnique({ where: { id: task.id } })).toMatchObject({ title: 'משימה מקומית' });
    expect(calls.every(call => call.method === 'GET')).toBe(true);
  });
  it('updates and removes imported events without changing local tasks or Google', async () => {
    const task = await db.task.create({ data: { userId, title: 'משימה מקומית', whenBucket: 'SCHEDULED', scheduledFor: today(), position: 'a0' } });
    await syncGoogleCalendar(connectionId);
    events = [{ ...events[0], summary: 'פגישה מעודכנת', start: { dateTime: '2026-12-03T12:00:00+02:00' }, end: { dateTime: '2026-12-03T13:30:00+02:00' } }];
    await syncGoogleCalendar(connectionId);
    expect(await db.googleCalendarEvent.findFirstOrThrow({ where: { source: { connectionId } } })).toMatchObject({ title: 'פגישה מעודכנת', allDay: false, startAt: new Date('2026-12-03T10:00:00Z') });
    events = [{ id: 'meeting1', status: 'cancelled' }]; await syncGoogleCalendar(connectionId);
    expect(await db.googleCalendarEvent.count({ where: { source: { connectionId } } })).toBe(0);
    expect(await db.task.findUnique({ where: { id: task.id } })).toMatchObject({ title: 'משימה מקומית', whenBucket: 'SCHEDULED', scheduledFor: today() });
    expect(calls.every(call => call.method === 'GET')).toBe(true);
  });
  it('cannot write even when legacy export flags and mappings are present', async () => {
    const task = await db.task.create({ data: { userId, title: 'Legacy task', whenBucket: 'SCHEDULED', scheduledFor: today(), position: 'a0' } });
    await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { syncTasks: true, syncAllDay: true, taskCalendarId: 'old-managed-calendar', taskSyncToken: 'old-token' } });
    await db.googleTaskLink.create({ data: { connectionId, taskId: task.id, eventId: 'old-event', fingerprint: 'old', taskUpdatedAt: task.updatedAt } });
    expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: true });
    expect(calls.every(call => call.method === 'GET')).toBe(true);
    expect(calls.some(call => call.path.includes('old-managed-calendar'))).toBe(false);
    expect(await db.task.findUnique({ where: { id: task.id } })).toMatchObject({ title: 'Legacy task' });
  });
  it('imports all pages and keeps the complete prior cache on provider failure', async () => {
    extraPage = true; await syncGoogleCalendar(connectionId);
    expect(await db.googleCalendarEvent.count({ where: { source: { connectionId } } })).toBe(2);
    providerError = 500; expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: false, error: 'SYNC_FAILED' });
    expect(await db.googleCalendarEvent.count({ where: { source: { connectionId } } })).toBe(2);
  });
  it('imports only enabled calendars and respects the display setting', async () => {
    await syncGoogleCalendar(connectionId);
    await db.googleCalendarSource.updateMany({ where: { connectionId }, data: { enabled: false } });
    calls = []; await syncGoogleCalendar(connectionId);
    expect(calls.some(call => call.path.startsWith(eventPath))).toBe(false);
    await db.googleCalendarSource.updateMany({ where: { connectionId }, data: { enabled: true } });
    await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { showEvents: false } });
    calls = []; await syncGoogleCalendar(connectionId);
    expect(calls.some(call => call.path.startsWith(eventPath))).toBe(false);
  });
  it('serializes manual and automatic imports and recovers an expired lease', async () => {
    const owner = await claimConnection(connectionId); expect(owner).toBeTruthy(); expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: false, error: 'BUSY' }); await releaseConnection(connectionId, 'other-owner'); expect(await claimConnection(connectionId)).toBeNull(); await releaseConnection(connectionId, owner!);
    await db.googleCalendarConnection.update({ where: { id: connectionId }, data: { leaseUntil: new Date(0) } }); expect(await syncGoogleCalendar(connectionId)).toEqual({ ok: true });
  });
  it('filters invalid external dates', () => { expect(externalEvent({ id: 'bad', start: { dateTime: 'invalid' }, end: { dateTime: 'invalid' } })).toBeNull(); });
});
