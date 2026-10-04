import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { CALLBACK_URL, googleConfigured } from '@/server/google/client';
import { GoogleCalendarSettings } from '@/components/settings/google-calendar-settings';

export const metadata = { title: 'יומנים · סדר' };
export default async function CalendarSettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const user = await getCurrentUser(); if (!user) notFound();
  const connection = await db.googleCalendarConnection.findUnique({ where: { userId: user.id }, select: { accountEmail: true, showEvents: true, syncTasks: true, syncAllDay: true, lastSyncAt: true, lastError: true, sources: { select: { id: true, name: true, enabled: true }, orderBy: { name: 'asc' } } } });
  const feed = await db.calendarFeed.findUnique({ where: { userId: user.id }, select: { id: true } });
  return <GoogleCalendarSettings configured={googleConfigured()} connection={connection ? { ...connection, lastSyncAt: connection.lastSyncAt?.toISOString() ?? null } : null} feedback={(await searchParams).google} feedActive={Boolean(feed)} setupCallback={process.env.SEDER_ADMIN_EMAIL?.toLowerCase() === user.email.toLowerCase() && !googleConfigured() ? CALLBACK_URL() : null} />;
}
