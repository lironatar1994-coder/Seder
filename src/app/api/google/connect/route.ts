import { randomBytes, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/server/auth/session';
import { db } from '@/server/db';
import { hashState, sealToken } from '@/server/google/crypto';
import { APP_URL, CALLBACK_URL, GOOGLE_SCOPES, googleConfigured } from '@/server/google/client';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(`${APP_URL()}/login?next=${encodeURIComponent('/app/settings/calendar')}`);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
  if (!googleConfigured()) return NextResponse.redirect(`${APP_URL()}/app/settings/calendar?google=unavailable`);
  const state = randomBytes(32).toString('base64url'); const verifier = randomBytes(32).toString('base64url');
  await db.googleOAuthState.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { userId: session.user.id }] } });
  await db.googleOAuthState.create({ data: { stateHash: hashState(state), userId: session.user.id, sessionId: session.sessionId, verifier: sealToken(verifier), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: CALLBACK_URL(), response_type: 'code', scope: GOOGLE_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set('seder-google-state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/seder/api/google', maxAge: 600 });
  response.headers.set('Cache-Control', 'no-store'); response.headers.set('Referrer-Policy', 'no-referrer'); return response;
}
