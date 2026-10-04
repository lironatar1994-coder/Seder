import { db } from '@/server/db';
import { hashState } from '@/server/google/crypto';
import { APP_URL } from '@/server/google/client';
import { calendarTaskWhere } from '@/server/google/sync';
import { calendarFeed } from '@/lib/google-calendar';
import { today, addDays } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response(null, { status: 404 });
  const feed = await db.calendarFeed.findUnique({ where: { tokenHash: hashState(token) }, select: { userId: true } });
  if (!feed) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const tasks = await db.task.findMany({ where: { ...calendarTaskWhere(feed.userId), whenBucket: 'SCHEDULED', scheduledFor: { gte: addDays(today(), -31), lte: addDays(today(), 365) } }, orderBy: { scheduledFor: 'asc' }, take: 5000 });
  return new Response(calendarFeed(tasks, APP_URL()), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="seder.ics"', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
}
