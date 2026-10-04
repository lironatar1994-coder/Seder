import { describe, expect, it } from 'vitest';
import { decideAt, minutesOfDay, morningInstant, morningIsDue } from './schedule';

/** A Wednesday, 00:00 Israel time (UTC+3 in August), as a real instant. */
const DAY_START = Date.UTC(2026, 7, 12, 21, 0, 0);
const at = (hours: number, minutes = 0) => new Date(DAY_START + (hours * 60 + minutes) * 60_000);

describe('minutesOfDay', () => {
  it('reads a time', () => {
    expect(minutesOfDay('00:00')).toBe(0);
    expect(minutesOfDay('09:05')).toBe(545);
    expect(minutesOfDay('14:30')).toBe(870);
    expect(minutesOfDay('23:59')).toBe(1439);
  });

  it('accepts a single-digit hour', () => {
    expect(minutesOfDay('9:05')).toBe(545);
  });

  it('refuses what is not a time', () => {
    expect(minutesOfDay('24:00')).toBeNull();
    expect(minutesOfDay('12:60')).toBeNull();
    expect(minutesOfDay('lunch')).toBeNull();
    expect(minutesOfDay('')).toBeNull();
  });
});

describe('decideAt', () => {
  const stale = 90;
  /* A 14:00 task with the default fifteen-minute lead: due at 13:45. The lead
     itself now lives in lib/reminder, so this only asks the one question left
     — early, due, or too late to be honest. */
  const fireAt = at(13, 45).valueOf();

  it('waits until the reminder is due', () => {
    expect(decideAt({ now: at(13, 44).valueOf(), fireAt, staleMinutes: stale })).toBe('wait');
  });

  it('sends on the dot', () => {
    expect(decideAt({ now: fireAt, fireAt, staleMinutes: stale })).toBe('send');
  });

  it('still sends a little late — better late than silent', () => {
    expect(decideAt({ now: at(14, 30).valueOf(), fireAt, staleMinutes: stale })).toBe('send');
  });

  it('gives up once it is hours late', () => {
    // The failure this exists to stop: the worker was down all afternoon, and
    // at 18:00 it delivers a 13:45 reminder as though it were news.
    expect(decideAt({ now: at(18, 0).valueOf(), fireAt, staleMinutes: stale })).toBe('stale');
  });

  it('draws the line exactly where it says', () => {
    expect(decideAt({ now: at(15, 15).valueOf(), fireAt, staleMinutes: stale })).toBe('send');
    expect(decideAt({ now: at(15, 15).valueOf() + 1, fireAt, staleMinutes: stale })).toBe('stale');
  });

  it('measures lateness from the reminder, not from the task', () => {
    // With an hour's lead those are an hour apart, and a 09:00 nudge for a
    // 10:00 meeting is useless at 14:00 whether or not the meeting has begun.
    const earlyFire = at(9, 0).valueOf();
    expect(decideAt({ now: at(11, 0).valueOf(), fireAt: earlyFire, staleMinutes: stale })).toBe(
      'stale',
    );
  });
});

describe('morningIsDue', () => {
  const base = { dayStart: DAY_START, hour: 8, graceMinutes: 180 };

  it('is not due before the hour', () => {
    expect(morningIsDue({ ...base, now: at(7, 59).valueOf() })).toBe(false);
  });

  it('is due on the hour', () => {
    expect(morningIsDue({ ...base, now: at(8, 0).valueOf() })).toBe(true);
  });

  it('is still due inside the grace period, so an outage does not skip a day', () => {
    expect(morningIsDue({ ...base, now: at(10, 30).valueOf() })).toBe(true);
    expect(morningIsDue({ ...base, now: at(11, 0).valueOf() })).toBe(true);
  });

  it('closes afterwards', () => {
    // Otherwise every task added at 15:00 for today would ping the instant it
    // was created, because 08:00 is long past.
    expect(morningIsDue({ ...base, now: at(11, 1).valueOf() })).toBe(false);
    expect(morningIsDue({ ...base, now: at(15, 0).valueOf() })).toBe(false);
  });

  it('reports the instant it is anchored to', () => {
    expect(morningInstant(DAY_START, 8)).toBe(at(8, 0).valueOf());
  });
});
