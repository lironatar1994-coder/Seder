import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/constants';

/**
 * Clears a session cookie that no longer refers to a live session, then sends
 * the visitor to the sign-in page.
 *
 * This exists because the two halves of the auth check can disagree. The
 * middleware runs on the Edge, where Prisma cannot reach the database, so it
 * only checks that a cookie *exists*; the real check happens in the
 * authenticated layout. When a session is destroyed elsewhere — a password
 * reset on another device, natural expiry, a wiped database — the cookie
 * outlives the session, and the layout's redirect to /login would be bounced
 * straight back to /app by the middleware, which still sees a cookie. That is
 * an infinite redirect and a locked-out user.
 *
 * A Route Handler can do what a Server Component cannot: actually delete the
 * cookie. One hop through here and the disagreement is resolved.
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next');
  const publicUrl = (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const url = new URL(`${publicUrl}/login`);

  if (next && next.startsWith('/app')) url.searchParams.set('next', next);

  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
