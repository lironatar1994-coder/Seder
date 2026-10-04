import { createHash } from 'node:crypto';
import { APP_TZ, addDays, isValidTime, toDayStart } from './dates';

export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  updated?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
}
export interface CalendarTask {
  id: string; title: string; notes: string | null; status: string;
  scheduledFor: Date | null; scheduledTime: string | null; durationMinutes: number;
}

const wallFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
export function wallParts(at: Date) {
  const parts = wallFormat.formatToParts(at);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return { day: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

/** Interpret wall time using the offset at the appointment, including DST. */
export function calendarInstant(day: string, time: string): Date {
  if (!validDay(day) || !isValidTime(time)) throw new Error('INVALID_CALENDAR_DATE');
  const desired = Date.parse(`${day}T${time}:00Z`);
  let guess = desired;
  for (let i = 0; i < 3; i++) {
    const parts = wallParts(new Date(guess));
    const apparent = Date.parse(`${parts.day}T${parts.time}:00Z`);
    const delta = desired - apparent;
    if (delta === 0) return new Date(guess);
    guess += delta;
  }
  // A non-existent clock time during the spring transition needs correction.
  throw new Error('INVALID_CALENDAR_DATE');
}
export function validDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}
export function safeCalendarLink(value: string | undefined | null) {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && ['calendar.google.com', 'www.google.com'].includes(url.hostname) ? url.href : null; } catch { return null; }
}
export function taskFingerprint(task: CalendarTask): string {
  return createHash('sha256').update(JSON.stringify([
    task.title, task.notes ?? '', task.status,
    task.scheduledFor?.toISOString().slice(0, 10) ?? null,
    task.scheduledTime, task.durationMinutes,
  ])).digest('hex');
}
export function taskEventId(connectionId: string, taskId: string) {
  return createHash('sha256').update(`${connectionId}:${taskId}`).digest('hex');
}
export function taskToGoogleEvent(task: CalendarTask, appUrl: string) {
  if (!task.scheduledFor) throw new Error('UNSCHEDULED_TASK');
  const day = task.scheduledFor.toISOString().slice(0, 10);
  const instant = task.scheduledTime ? calendarInstant(day, task.scheduledTime) : null;
  return {
    summary: `${task.status === 'DONE' ? '✔️ ' : ''}${task.title}`,
    description: task.notes ?? '',
    start: instant ? { dateTime: instant.toISOString(), timeZone: APP_TZ } : { date: day },
    end: instant ? { dateTime: new Date(instant.getTime() + task.durationMinutes * 60_000).toISOString(), timeZone: APP_TZ } : { date: addDays(task.scheduledFor, 1).toISOString().slice(0, 10) },
    source: { title: 'סדר', url: `${appUrl}/app/today?task=${encodeURIComponent(task.id)}` },
    extendedProperties: { private: { sederTaskId: task.id } },
    reminders: { useDefault: false },
  };
}
export function googleEventToTask(event: GoogleEvent, current: CalendarTask): CalendarTask | null {
  if (event.status === 'cancelled' || !event.start || !event.end) return null;
  let day: string; let time: string | null; let duration = current.durationMinutes;
  if (event.start.date) { day = event.start.date; time = null; }
  else {
    const start = new Date(event.start.dateTime ?? ''); const end = new Date(event.end.dateTime ?? '');
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
    const parts = wallParts(start); day = parts.day; time = parts.time;
    duration = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (duration < 1 || duration > 1440) return null;
  }
  if (!validDay(day)) return null;
  const title = (current.status === 'DONE' ? (event.summary ?? '').replace(/^✔️?\s*/, '') : event.summary ?? '').trim();
  if (!title || title.length > 500 || (event.description?.length ?? 0) > 10_000) return null;
  return { ...current, title, notes: event.description || null, scheduledFor: new Date(`${day}T00:00:00Z`), scheduledTime: time, durationMinutes: duration };
}
export function externalEvent(event: GoogleEvent) {
  if (event.status === 'cancelled' || !event.start || !event.end) return null;
  const allDay = Boolean(event.start.date);
  const startAt = new Date(allDay ? `${event.start.date}T00:00:00Z` : event.start.dateTime ?? '');
  const endAt = new Date(allDay ? `${event.end.date}T00:00:00Z` : event.end.dateTime ?? '');
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) return null;
  return { googleId: event.id, title: (event.summary || 'אירוע ללא כותרת').slice(0, 500), startAt, endAt,
    startDay: allDay ? event.start.date! : toDayStart(startAt).toISOString().slice(0, 10),
    endDay: allDay ? addDays(endAt, -1).toISOString().slice(0, 10) : toDayStart(new Date(endAt.getTime() - 1)).toISOString().slice(0, 10),
    allDay, htmlLink: safeCalendarLink(event.htmlLink), location: event.location?.slice(0, 500) ?? null };
}

function escapeICS(value: string) { return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
/** Fold by UTF-8 octets, without splitting a Hebrew code point. */
function foldICS(line: string) {
  const lines: string[] = []; let current = ''; let length = 0;
  for (const point of line) { const bytes = Buffer.byteLength(point); if (length + bytes > 75) { lines.push(current); current = ' '; length = 1; } current += point; length += bytes; }
  lines.push(current); return lines.join('\r\n');
}
export function calendarFeed(tasks: CalendarTask[], appUrl: string, now = new Date()) {
  const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Seder//Calendar//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:סדר'];
  for (const task of tasks) {
    if (!task.scheduledFor) continue;
    let event; try { event = taskToGoogleEvent(task, appUrl); } catch { continue; }
    lines.push('BEGIN:VEVENT', `UID:${task.id}@seder`, `DTSTAMP:${stamp(now)}`);
    if ('dateTime' in event.start && event.start.dateTime) lines.push(`DTSTART:${stamp(new Date(event.start.dateTime))}`, `DTEND:${stamp(new Date(event.end.dateTime!))}`);
    else lines.push(`DTSTART;VALUE=DATE:${event.start.date!.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${event.end.date!.replace(/-/g, '')}`);
    lines.push(`SUMMARY:${escapeICS(event.summary)}`, `DESCRIPTION:${escapeICS(event.description)}`, `URL:${event.source.url}`, 'END:VEVENT');
  }
  return lines.concat('END:VCALENDAR').map(foldICS).join('\r\n') + '\r\n';
}
