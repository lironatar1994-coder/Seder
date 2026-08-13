import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/constants';

/**
 * Cheap routing guard only.
 *
 * Middleware runs on the Edge runtime, where Prisma cannot reach the database,
 * so this checks for the *presence* of a session cookie and nothing more. The
 * cookie is verified for real in the authenticated layout via
 * `getCurrentUser()` — a forged or expired cookie gets past here and is
 * rejected there, one request later, before anything renders.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicUrl = (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith('/app')) {
    if (!hasCookie) {
      const url = new URL(`${publicUrl}/login`);
      // Send them back where they were headed once they are in.
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if ((pathname === '/login' || pathname === '/register') && hasCookie) {
    const url = new URL(`${publicUrl}/app`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/login', '/register'],
};
