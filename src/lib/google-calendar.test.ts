import { describe, expect, it } from 'vitest';
import { calendarFeed, calendarInstant, externalEvent, googleEventToTask, taskEventId, taskToGoogleEvent, validDay, type CalendarTask } from './google-calendar';
const task: CalendarTask = { id: 'task1', title: 'פגישה חשובה', notes: 'שורה אחת\nשורה שנייה', status: 'TODO', scheduledFor: new Date('2026-10-04T00:00:00Z'), scheduledTime: '09:30', durationMinutes: 45 };
describe('Google Calendar date and event mapping', () => {
  it('interprets summer and winter appointments in Israel', () => {
    expect(calendarInstant('2026-07-01', '09:30').toISOString()).toBe('2026-07-01T06:30:00.000Z');
    expect(calendarInstant('2026-12-01', '09:30').toISOString()).toBe('2026-12-01T07:30:00.000Z');
  });
  it('uses the appointment offset when DST changes during the day', () => {
    expect(calendarInstant('2026-10-25', '09:30').toISOString()).toBe('2026-10-25T07:30:00.000Z');
    expect(calendarInstant('2026-03-27', '09:30').toISOString()).toBe('2026-03-27T06:30:00.000Z');
    expect(() => calendarInstant('2026-03-27', '02:30')).toThrow('INVALID_CALENDAR_DATE');
  });
  it('rejects impossible days', () => { expect(validDay('2026-02-30')).toBe(false); expect(validDay('2026-02-28')).toBe(true); });
  it('exports an exclusive all-day end and timed duration crossing midnight', () => {
    const allDay = taskToGoogleEvent({ ...task, scheduledTime: null }, 'https://lawebs.co.il/seder');
    expect(allDay.start).toEqual({ date: '2026-10-04' }); expect(allDay.end).toEqual({ date: '2026-10-05' });
    const timed = taskToGoogleEvent({ ...task, scheduledTime: '23:30', durationMinutes: 90 }, 'https://lawebs.co.il/seder');
    expect(timed.end.dateTime).toBe('2026-10-04T22:00:00.000Z');
  });
  it('imports Google moves in Israel time and validates duration and title', () => {
    const event = { id: 'event1', summary: 'כותרת חדשה', description: 'פירוט', start: { dateTime: '2026-12-02T23:30:00-05:00' }, end: { dateTime: '2026-12-03T00:30:00-05:00' } };
    expect(googleEventToTask(event, task)).toMatchObject({ title: 'כותרת חדשה', scheduledFor: new Date('2026-12-03T00:00:00Z'), scheduledTime: '06:30', durationMinutes: 60 });
    expect(googleEventToTask({ ...event, end: event.start }, task)).toBeNull();
    expect(googleEventToTask({ ...event, summary: '' }, task)).toBeNull();
  });
  it('deduplicates retry inserts with provider-safe IDs', () => { expect(taskEventId('connection', 'task')).toMatch(/^[0-9a-f]{64}$/); expect(taskEventId('connection', 'task')).toBe(taskEventId('connection', 'task')); });
  it('normalizes multi-day events, cancellations and safe links', () => {
    expect(externalEvent({ id: 'holiday', summary: 'חופשה', start: { date: '2026-10-04' }, end: { date: '2026-10-07' }, htmlLink: 'javascript:alert(1)' })).toMatchObject({ startDay: '2026-10-04', endDay: '2026-10-06', allDay: true, htmlLink: null });
    expect(externalEvent({ id: 'deleted', status: 'cancelled' })).toBeNull();
    expect(externalEvent({ id: 'event', start: { dateTime: '2026-10-04T21:00:00Z' }, end: { dateTime: '2026-10-05T01:00:00Z' }, htmlLink: 'https://calendar.google.com/calendar/event?eid=abc' })).toMatchObject({ startDay: '2026-10-05', endDay: '2026-10-05' });
  });
  it('exports valid folded Hebrew ICS and escapes injected properties', () => {
    const text = calendarFeed([{ ...task, title: 'שלום'.repeat(40), notes: 'test\nBEGIN:VEVENT;bad,value\\text' }], 'https://lawebs.co.il/seder');
    for (const line of text.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(text).toContain('DESCRIPTION:test\\nBEGIN:VEVENT\\;bad\\,value\\\\text');
    expect(text.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(text).toContain('DTSTART:20261004T063000Z');
  });
});
