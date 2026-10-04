import 'server-only';
import { db } from '../db';
import { addDays } from '../../lib/dates';
import type { GoogleEventDTO } from '../../lib/calendar-event-types';

export async function getGoogleEvents(userId: string, from: string, to: string) {
  const rows = await db.googleCalendarEvent.findMany({ where: { startDay: { lte: to }, endDay: { gte: from }, source: { enabled: true, connection: { userId, showEvents: true } } }, include: { source: { select: { name: true } } }, orderBy: { startAt: 'asc' }, take: 1000 });
  return rows.map(row => ({ id: row.id, title: row.title, calendar: row.source.name, startAt: row.startAt.toISOString(), endAt: row.endAt.toISOString(), startDay: row.startDay, endDay: row.endDay, allDay: row.allDay, htmlLink: row.htmlLink, location: row.location })) satisfies GoogleEventDTO[];
}
export function groupGoogleEvents(events: GoogleEventDTO[], from: string, to: string) {
  const grouped: Record<string, GoogleEventDTO[]> = {};
  for (const event of events) {
    const first = event.startDay > from ? event.startDay : from;
    const last = event.endDay < to ? event.endDay : to;
    for (let date = new Date(`${first}T00:00:00Z`); date.toISOString().slice(0, 10) <= last; date = addDays(date, 1)) {
      (grouped[date.toISOString().slice(0, 10)] ??= []).push(event);
    }
  }
  return grouped;
}
