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

  // A single public URL within the verified /seder/ property, including query
  // preservation for account-deletion notices and existing campaign links.
  if (pathname === '/' && !new URL(request.url).pathname.endsWith('/')) {
    const url = new URL(`${publicUrl}/`);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url, 308);
  }

  if (pathname !== '/' && pathname.endsWith('/')) {
    const url = new URL(`${publicUrl}${pathname.replace(/\/+$/, '')}`);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url, 308);
  }

  if (pathname === '/app' || pathname.startsWith('/app/') || pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!hasCookie) {
      const url = new URL(`${publicUrl}/login`);
      // Send them back where they were headed once they are in.
      url.searchParams.set('next', pathname + request.nextUrl.search);
      const response = NextResponse.redirect(url);
      response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      return response;
    }
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (pathname === '/admin' || pathname.startsWith('/admin/')) response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  }

  const response = NextResponse.next();
  if (pathname !== '/') response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export const config = {
  matcher: ['/', '/app/:path*', '/admin/:path*', '/login', '/register', '/forgot', '/reset/:path*', '/signed-out', '/api/:path*'],
};
