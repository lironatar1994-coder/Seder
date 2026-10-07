import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { db } from '@/server/db';
import { SESSION_COOKIE, SESSION_TTL_MS, SESSION_RENEW_AFTER_MS } from '@/lib/constants';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  defaultView: string;
  role: string;
  /** The hour an untimed task's reminder fires. */
  reminderHour: number;
}

export interface CurrentSession {
  /** Needed to keep *this* session alive when signing the others out. */
  sessionId: string;
  user: SessionUser;
}

/** The cookie carries a raw token; the database stores only this hash. A dump
 *  of the sessions table therefore hands over nothing usable. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });
  await db.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Resolves the signed-in user, or null.
 *
 * Wrapped in React `cache` so a page that checks auth in the layout, the page
 * and three server components still performs one database round trip.
 */
export const getCurrentSession = cache(async (): Promise<CurrentSession | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, role: true, lastActiveAt: true, defaultView: true, reminderHour: true } },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Sliding expiry: renew once past halfway so an active user is never logged
  // out mid-session, without writing to the database on every request.
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < SESSION_RENEW_AFTER_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } }).catch(() => {});
  }

  // Conditional update also throttles concurrent tabs. No task content is used
  // to infer a visit, and background workers do not count as active users.
  const activityCutoff = new Date(Date.now() - 10 * 60_000);
  if (!session.user.lastActiveAt || session.user.lastActiveAt < activityCutoff) {
    await db.user.updateMany({
      where: { id: session.user.id, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: activityCutoff } }] },
      data: { lastActiveAt: new Date() },
    });
  }

  return { sessionId: session.id, user: session.user };
});

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  return (await getCurrentSession())?.user ?? null;
});

/** For actions that must not touch the session they are running in — signing
 *  the *other* devices out, for one. */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

/** For server components that cannot render without a user. Callers in the
 *  authenticated segment rely on the layout having redirected already; this is
 *  the belt-and-braces version for actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

/** Constant-time compare, used where a timing difference would leak. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
