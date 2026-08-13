/**
 * When a reminder is due, as arithmetic.
 *
 * Pulled out of the socket module because this is the part that can be wrong
 * without anything crashing: a reminder that fires an hour early, or one that
 * arrives at 18:00 for a 09:00 task and reads as though it were fresh. Both
 * are silent, and both are what the system this replaces actually did.
 *
 * Everything here takes `dayStart` — the real instant the Israeli calendar day
 * began — rather than reading a clock. The caller gets that from
 * `dayStartInstant`, which is DST-correct; doing the arithmetic against the
 * server's own midnight is the bug this shape exists to prevent.
 */

/** Minutes past midnight for "HH:MM", or null if it is not a time. */
export function minutesOfDay(time: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23) return null;

  return hours * 60 + minutes;
}

export type TimedVerdict =
  /** Not yet — the lead time has not been reached. */
  | 'wait'
  /** Send it. */
  | 'send'
  /** So late that delivering it would misinform rather than remind. */
  | 'stale';

export function decideTimed(input: {
  now: number;
  dayStart: number;
  time: string;
  leadMinutes: number;
  staleMinutes: number;
}): TimedVerdict {
  const offset = minutesOfDay(input.time);
  // An unparseable time is not a thing to send and not a thing to retry
  // forever either; treating it as stale retires it quietly.
  if (offset === null) return 'stale';

  const startsAt = input.dayStart + offset * 60_000;

  if (input.now < startsAt - input.leadMinutes * 60_000) return 'wait';
  if (input.now > startsAt + input.staleMinutes * 60_000) return 'stale';
  return 'send';
}

/** The instant the morning note is due. */
export function morningInstant(dayStart: number, hour: number): number {
  return dayStart + hour * 60 * 60_000;
}

/**
 * Is the morning note due now?
 *
 * A window rather than a threshold. Open-ended, every task added at 15:00 for
 * today would ping the moment it was created, because 08:00 is long past. The
 * grace period is what still lets a worker that was down at 08:00 send it at
 * 09:30 instead of skipping the day.
 */
export function morningIsDue(input: {
  now: number;
  dayStart: number;
  hour: number;
  graceMinutes: number;
}): boolean {
  const at = morningInstant(input.dayStart, input.hour);
  return input.now >= at && input.now <= at + input.graceMinutes * 60_000;
}
