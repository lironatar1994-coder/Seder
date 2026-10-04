import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/server/auth/session';
import { db } from '@/server/db';
import { hashState, openToken, sealToken } from '@/server/google/crypto';
import { APP_URL, CALLBACK_URL, GOOGLE_SCOPES, googleConfigured, googleToken } from '@/server/google/client';
import type { GoogleCalendarListEntry } from '@/server/google/sync';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const finish = (status: string) => {
    const response = NextResponse.redirect(`${APP_URL()}/app/settings/calendar?google=${status}`);
    response.cookies.delete({ name: 'seder-google-state', path: '/seder/api/google' });
    response.headers.set('Cache-Control', 'no-store'); response.headers.set('Referrer-Policy', 'no-referrer'); return response;
  };
  const session = await getCurrentSession(); const state = request.nextUrl.searchParams.get('state');
  if (!session || !state || state.length > 100 || state !== request.cookies.get('seder-google-state')?.value || !googleConfigured()) return finish('invalid');
  const flow = await db.googleOAuthState.findUnique({ where: { stateHash: hashState(state) } });
  if (!flow || flow.userId !== session.user.id || flow.sessionId !== session.sessionId || flow.expiresAt <= new Date()) return finish('invalid');
  const consumed = await db.googleOAuthState.deleteMany({ where: { id: flow.id, expiresAt: { gt: new Date() } } });
  if (consumed.count !== 1) return finish('invalid');
  if (request.nextUrl.searchParams.has('error')) return finish('cancelled');
  const code = request.nextUrl.searchParams.get('code'); if (!code || code.length > 4096) return finish('invalid');
  try {
    const token = await googleToken({ grant_type: 'authorization_code', code, redirect_uri: CALLBACK_URL(), code_verifier: openToken(flow.verifier) });
    if (!GOOGLE_SCOPES.every(scope => token.scope?.split(' ').includes(scope))) return finish('permissions');
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250', { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    if (!response.ok) return finish('permissions');
    const calendars = await response.json() as { items?: GoogleCalendarListEntry[] };
    const primary = calendars.items?.find(calendar => calendar.primary);
    if (!primary?.id) return finish('failed');
    const previous = await db.googleCalendarConnection.findUnique({ where: { userId: session.user.id } });
    if (previous && previous.accountEmail !== primary.id) return finish('disconnect-first');
    if (!token.refresh_token && !previous) return finish('failed');
    if (previous?.leaseUntil && previous.leaseUntil > new Date()) return finish('busy');
    await db.googleCalendarConnection.upsert({ where: { userId: session.user.id },
      create: { userId: session.user.id, accountEmail: primary.id, refreshToken: sealToken(token.refresh_token!), accessToken: sealToken(token.access_token), accessExpiresAt: new Date(Date.now() + token.expires_in * 1000) },
      update: { ...(token.refresh_token ? { refreshToken: sealToken(token.refresh_token) } : {}), accessToken: sealToken(token.access_token), accessExpiresAt: new Date(Date.now() + token.expires_in * 1000), lastError: null, lastSyncAt: null },
    });
    return finish('connected');
  } catch {
    // Authorization codes, tokens and Google responses never enter logs.
    console.warn(JSON.stringify({ event: 'calendar.connect.failed' })); return finish('failed');
  }
}
