import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import { existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { NextRequest } from 'next/server';
import { db } from '../db';
import { hashState, sealToken, openToken } from './crypto';
import { GOOGLE_SCOPES } from './client';
import { syncGoogleCalendar } from './sync';
vi.mock('./sync', () => ({ syncGoogleCalendar: vi.fn(async () => ({ ok: true })) }));
import { GET as connect } from '../../app/api/google/connect/route';
import { GET as callback } from '../../app/api/google/callback/route';

const auth = vi.hoisted(() => ({ session: null as { user: { id: string }; sessionId: string } | null }));
vi.mock('server-only', () => ({}));
vi.mock('../auth/session', () => ({ getCurrentSession: () => Promise.resolve(auth.session) }));
vi.mock('../db', async () => { const { PrismaClient } = await import('@prisma/client'); return { db: new PrismaClient({ datasourceUrl: 'file:./google-oauth-test.db' }) }; });
let userId: string;
const endpoint = 'http://localhost:3000/seder/api/google';
beforeAll(() => { if (!existsSync('prisma/google-oauth-test.db')) writeFileSync('prisma/google-oauth-test.db', ''); execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: 'file:./google-oauth-test.db' }, stdio: 'pipe' }); });
beforeEach(async () => {
  vi.mocked(syncGoogleCalendar).mockClear();
  vi.stubEnv('GOOGLE_CLIENT_ID', 'fake-client'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'fake-secret'); vi.stubEnv('GOOGLE_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64')); vi.stubEnv('GOOGLE_CALENDAR_ENABLED', '1'); vi.stubEnv('APP_URL', 'http://localhost:3000/seder');
  const user = await db.user.create({ data: { name: 'OAuth test', email: `oauth-${crypto.randomUUID()}@seder.test`, passwordHash: 'unused' } }); userId = user.id; auth.session = { user: { id: userId }, sessionId: 'signed-in-session' };
});
afterEach(async () => { await db.user.deleteMany({ where: { name: 'OAuth test', email: { endsWith: '@seder.test' } } }); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterAll(async () => { await db.$disconnect(); });
async function pendingState() { const state = crypto.randomUUID(); await db.googleOAuthState.create({ data: { stateHash: hashState(state), userId, sessionId: 'signed-in-session', verifier: sealToken('test-verifier'), expiresAt: new Date(Date.now() + 60_000) } }); return state; }
function request(state: string, cookie = state) { const request = new NextRequest(`${endpoint}/callback?state=${state}&code=fake-code`); request.cookies.set('seder-google-state', cookie); return request; }
function fakeGoogle(scopes = GOOGLE_SCOPES.join(' ')) { vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/token') ? { access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 3600, scope: scopes } : { items: [{ id: 'google-user@gmail.com', primary: true, summary: 'Primary' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))); }
describe('Google OAuth session binding and token exchange', () => {
  it('issues PKCE, least-privilege scopes and a hashed single-use state', async () => {
    const response = await connect(new NextRequest(`${endpoint}/connect`)); const url = new URL(response.headers.get('location')!);
    expect(url.origin).toBe('https://accounts.google.com'); expect(url.searchParams.get('code_challenge_method')).toBe('S256'); expect(url.searchParams.get('scope')).toBe(GOOGLE_SCOPES.join(' '));
    const state = url.searchParams.get('state')!; const stored = await db.googleOAuthState.findUniqueOrThrow({ where: { stateHash: hashState(state) } }); expect(stored.verifier).not.toBe(openToken(stored.verifier)); expect(stored.sessionId).toBe('signed-in-session'); expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });
  it('rejects unauthenticated or cross-site connection starts', async () => {
    auth.session = null; expect((await connect(new NextRequest(`${endpoint}/connect`))).headers.get('location')).toContain('/login?next='); auth.session = { user: { id: userId }, sessionId: 'signed-in-session' }; expect((await connect(new NextRequest(`${endpoint}/connect`, { headers: { 'sec-fetch-site': 'cross-site' } }))).status).toBe(403);
  });
  it('rejects mismatched state cookies, sessions and expired requests without sending codes', async () => {
    fakeGoogle(); const state = await pendingState(); expect((await callback(request(state, 'wrong'))).headers.get('location')).toContain('google=invalid'); expect(fetch).not.toHaveBeenCalled();
    auth.session!.sessionId = 'different-session'; expect((await callback(request(state))).headers.get('location')).toContain('google=invalid'); expect(fetch).not.toHaveBeenCalled();
    auth.session!.sessionId = 'signed-in-session'; await db.googleOAuthState.update({ where: { stateHash: hashState(state) }, data: { expiresAt: new Date(0) } }); expect((await callback(request(state))).headers.get('location')).toContain('google=invalid'); expect(fetch).not.toHaveBeenCalled();
  });
  it('consumes once, stores encrypted tokens and denies callback replay', async () => {
    fakeGoogle(); const state = await pendingState(); expect((await callback(request(state))).headers.get('location')).toContain('google=connected'); const connection = await db.googleCalendarConnection.findUniqueOrThrow({ where: { userId } }); expect(connection.refreshToken).not.toContain('refresh-token'); expect(openToken(connection.refreshToken)).toBe('refresh-token'); expect(connection.accountEmail).toBe('google-user@gmail.com');
    expect(connection.syncTasks).toBe(false); expect(connection.syncAllDay).toBe(false);
    expect(syncGoogleCalendar).toHaveBeenCalledWith(connection.id);
    expect((await callback(request(state))).headers.get('location')).toContain('google=invalid'); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('handles cancellation and missing consent without retaining a connection', async () => {
    const state = await pendingState(); const cancelled = new NextRequest(`${endpoint}/callback?state=${state}&error=access_denied`); cancelled.cookies.set('seder-google-state', state); expect((await callback(cancelled)).headers.get('location')).toContain('google=cancelled'); expect(await db.googleOAuthState.count({ where: { userId } })).toBe(0);
    fakeGoogle(GOOGLE_SCOPES[0]); expect((await callback(request(await pendingState()))).headers.get('location')).toContain('google=permissions'); expect(await db.googleCalendarConnection.count({ where: { userId } })).toBe(0);
  });
});
