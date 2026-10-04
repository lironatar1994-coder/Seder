import { describe, expect, it } from 'vitest';
import {
  REMINDER_OFF,
  hourLabel,
  isReminderOff,
  reminderFireAt,
  reminderLabel,
  reminderLead,
  reminderOptionsFor,
} from './reminder';

/** A day, as stored: UTC midnight of the intended Israeli calendar day. */
const DAY = new Date('2026-08-13T00:00:00.000Z');
/** That day actually began at 21:00 UTC the evening before (UTC+3 in August). */
const DAY_START = Date.UTC(2026, 7, 12, 21, 0, 0);
const at = (hours: number, minutes = 0) => new Date(DAY_START + (hours * 60 + minutes) * 60_000);

const base = { reminderHour: 8, defaultLead: 15 };

describe('reminderOptionsFor', () => {
  it('offers the time-relative choices only when there is a time', () => {
    const timed = reminderOptionsFor(true).map((o) => o.value);
    expect(timed).toContain('10');
    expect(timed).toContain('0');

    const untimed = reminderOptionsFor(false).map((o) => o.value);
    // "Ten minutes before" is meaningless when there is no moment to be before.
    expect(untimed).not.toContain('10');
    expect(untimed).not.toContain('0');
    // A whole day earlier still means something.
    expect(untimed).toEqual([null, '1440', REMINDER_OFF]);
  });
});

describe('reminderLead', () => {
  it('reads a lead', () => {
    expect(reminderLead('30')).toBe(30);
    expect(reminderLead('0')).toBe(0);
  });

  it('is null for the states that are not leads', () => {
    expect(reminderLead(null)).toBeNull();
    expect(reminderLead(undefined)).toBeNull();
    expect(reminderLead(REMINDER_OFF)).toBeNull();
    expect(reminderLead('nonsense')).toBeNull();
    expect(reminderLead('-5')).toBeNull();
  });
});

describe('reminderLabel', () => {
  it('spells out what the default actually is', () => {
    // A control reading only "default" makes you go and look up the default,
    // which is the one thing it could have told you.
    expect(reminderLabel(null, { ...base, hasTime: true })).toBe('ברירת מחדל · 15 דק׳ לפני');
    expect(reminderLabel(null, { ...base, hasTime: false })).toBe('ברירת מחדל · 08:00');
    expect(reminderLabel(null, { ...base, hasTime: false, reminderHour: 7 })).toContain('07:00');
  });

  it('names an explicit choice', () => {
    expect(reminderLabel('30', { ...base, hasTime: true })).toBe('חצי שעה לפני');
    expect(reminderLabel('1440', { ...base, hasTime: false })).toBe('יום לפני');
    expect(reminderLabel(REMINDER_OFF, { ...base, hasTime: true })).toBe('בלי תזכורת');
  });
});

describe('reminderFireAt', () => {
  const call = (over: Partial<Parameters<typeof reminderFireAt>[0]>) =>
    reminderFireAt({
      scheduledFor: DAY,
      scheduledTime: null,
      reminder: null,
      ...base,
      ...over,
    });

  it('has nothing to fire for an unscheduled task', () => {
    // A reminder needs a day before it can need an hour.
    expect(call({ scheduledFor: null, scheduledTime: '14:00' })).toBeNull();
  });

  it('is null when the task turned it off', () => {
    expect(call({ scheduledTime: '14:00', reminder: REMINDER_OFF })).toBeNull();
    expect(call({ reminder: REMINDER_OFF })).toBeNull();
  });

  describe('a task with a time', () => {
    it('uses the account lead by default', () => {
      expect(call({ scheduledTime: '14:00' })).toEqual(at(13, 45));
    });

    it('honours an explicit lead', () => {
      expect(call({ scheduledTime: '14:00', reminder: '60' })).toEqual(at(13, 0));
      expect(call({ scheduledTime: '14:00', reminder: '0' })).toEqual(at(14, 0));
    });

    it('can be a whole day earlier', () => {
      expect(call({ scheduledTime: '14:00', reminder: '1440' })).toEqual(
        new Date(DAY_START - 10 * 60 * 60_000),
      );
    });

    it('is anchored to the Israeli day, not the server one', () => {
      // 09:00 Israel is 06:00 UTC. Reading the hour off a UTC clock would fire
      // every reminder three hours late, and four in winter.
      const fire = call({ scheduledTime: '09:00', reminder: '0' })!;
      expect(fire.getUTCHours()).toBe(6);
    });

    it('is null for a time it cannot read', () => {
      expect(call({ scheduledTime: 'בערב' })).toBeNull();
    });
  });

  describe('a task with no time', () => {
    it('fires at the account hour', () => {
      expect(call({})).toEqual(at(8, 0));
    });

    it('follows the setting when it changes', () => {
      expect(call({ reminderHour: 6 })).toEqual(at(6, 0));
      expect(call({ reminderHour: 21 })).toEqual(at(21, 0));
    });

    it('ignores the account lead — 07:45 is precision about nothing', () => {
      // The hour is already someone's arbitrary choice; shifting it by the
      // default fifteen minutes would make the setting a lie.
      expect(call({ defaultLead: 15 })).toEqual(at(8, 0));
    });

    it('still understands a whole day earlier', () => {
      expect(call({ reminder: '1440' })).toEqual(
        new Date(DAY_START + 8 * 60 * 60_000 - 24 * 60 * 60_000),
      );
    });
  });
});

describe('hourLabel', () => {
  it('pads to a readable clock time', () => {
    expect(hourLabel(8)).toBe('08:00');
    expect(hourLabel(21)).toBe('21:00');
    expect(hourLabel(0)).toBe('00:00');
  });
});

describe('isReminderOff', () => {
  it('is only true for the explicit off', () => {
    expect(isReminderOff(REMINDER_OFF)).toBe(true);
    expect(isReminderOff(null)).toBe(false);
    expect(isReminderOff('0')).toBe(false);
  });
});
