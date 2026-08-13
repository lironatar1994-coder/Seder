import { describe, expect, it } from 'vitest';
import { decideTimed, minutesOfDay, morningInstant, morningIsDue } from './schedule';

/** A Wednesday, 00:00 Israel time (UTC+3 in August), as a real instant. */
const DAY_START = Date.UTC(2026, 7, 12, 21, 0, 0);
const at = (hours: number, minutes = 0) => DAY_START + (hours * 60 + minutes) * 60_000;

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

describe('decideTimed', () => {
  const base = { dayStart: DAY_START, time: '14:30', leadMinutes: 15, staleMinutes: 90 };

  it('waits until the lead time', () => {
    expect(decideTimed({ ...base, now: at(14, 14) })).toBe('wait');
  });

  it('sends from exactly the lead time', () => {
    expect(decideTimed({ ...base, now: at(14, 15) })).toBe('send');
  });

  it('still sends at the moment the task starts', () => {
    expect(decideTimed({ ...base, now: at(14, 30) })).toBe('send');
  });

  it('still sends a little after — better late than silent', () => {
    expect(decideTimed({ ...base, now: at(15, 30) })).toBe('send');
  });

  it('gives up once it is hours late', () => {
    // The failure this exists to stop: the worker was down all afternoon, and
    // at 18:00 it delivers a 14:30 reminder as though it were news.
    expect(decideTimed({ ...base, now: at(18, 0) })).toBe('stale');
  });

  it('draws the stale line exactly where it says', () => {
    expect(decideTimed({ ...base, now: at(16, 0) })).toBe('send');
    expect(decideTimed({ ...base, now: at(16, 0) + 1 })).toBe('stale');
  });

  it('retires a time it cannot read instead of retrying it forever', () => {
    expect(decideTimed({ ...base, time: 'בערב', now: at(14, 30) })).toBe('stale');
  });

  it('measures from the Israeli midnight, not the server one', () => {
    // DAY_START is 21:00 UTC the previous day. A 09:00 task is therefore at
    // 06:00 UTC — reading the hour off a UTC clock would fire it three hours
    // late every day, and four in winter.
    const nineAM = decideTimed({ ...base, time: '09:00', now: at(9, 0) });
    expect(nineAM).toBe('send');
    expect(new Date(at(9, 0)).getUTCHours()).toBe(6);
  });
});

describe('morningIsDue', () => {
  const base = { dayStart: DAY_START, hour: 8, graceMinutes: 180 };

  it('is not due before the hour', () => {
    expect(morningIsDue({ ...base, now: at(7, 59) })).toBe(false);
  });

  it('is due on the hour', () => {
    expect(morningIsDue({ ...base, now: at(8, 0) })).toBe(true);
  });

  it('is still due inside the grace period, so an outage does not skip a day', () => {
    expect(morningIsDue({ ...base, now: at(10, 30) })).toBe(true);
    expect(morningIsDue({ ...base, now: at(11, 0) })).toBe(true);
  });

  it('closes afterwards', () => {
    // Otherwise every task added at 15:00 for today would ping the instant it
    // was created, because 08:00 is long past.
    expect(morningIsDue({ ...base, now: at(11, 1) })).toBe(false);
    expect(morningIsDue({ ...base, now: at(15, 0) })).toBe(false);
  });

  it('reports the instant it is anchored to', () => {
    expect(morningInstant(DAY_START, 8)).toBe(at(8, 0));
  });
});
