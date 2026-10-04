/**
 * When a task's reminder is due.
 *
 * A reminder is always *relative to an anchor*, and the anchor depends on what
 * the task knows about itself:
 *
 *   - it has a time  → the anchor is that time on the scheduled day
 *   - it has no time → the anchor is the account's `reminderHour` on that day
 *
 * That second case is the whole point of the feature: "buy milk on Thursday"
 * deserves a nudge as much as "call the dentist at 14:00" does, and the hour
 * it arrives at is a habit set once for the account rather than a question
 * asked on every task.
 *
 * The stored value is three states in one nullable column — see the schema
 * comment on `Task.reminder`. Everything here is pure, so the decision that
 * actually pages somebody at 08:00 is testable without a clock or a socket.
 */

import { wallTimeInstant } from '@/lib/dates';

/** Explicitly no reminder, as stored. */
export const REMINDER_OFF = 'off';

export interface ReminderOption {
  /** Stored in `Task.reminder`. `null` means "follow the account default". */
  value: string | null;
  label: string;
  /** Meaningless without a time of day, so hidden for tasks that have none. */
  needsTime?: boolean;
}

/**
 * The choices offered, in the order they are offered.
 *
 * "Default" first because it is the answer for almost every task, and "off"
 * last because turning a reminder off is the rarer, more deliberate act.
 */
export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: null, label: 'ברירת מחדל' },
  { value: '0', label: 'בזמן המשימה', needsTime: true },
  { value: '10', label: '10 דקות לפני', needsTime: true },
  { value: '30', label: 'חצי שעה לפני', needsTime: true },
  { value: '60', label: 'שעה לפני', needsTime: true },
  { value: '1440', label: 'יום לפני' },
  { value: REMINDER_OFF, label: 'בלי תזכורת' },
];

/** The options that make sense for this task. */
export function reminderOptionsFor(hasTime: boolean): ReminderOption[] {
  return REMINDER_OPTIONS.filter((option) => hasTime || !option.needsTime);
}

/** Minutes before the anchor, or null when the value is not a lead. */
export function reminderLead(stored: string | null | undefined): number | null {
  if (stored === null || stored === undefined || stored === REMINDER_OFF) return null;
  const minutes = Number(stored);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

export function isReminderOff(stored: string | null | undefined): boolean {
  return stored === REMINDER_OFF;
}

/**
 * What the picker should read, given what the task and account say.
 *
 * The default is spelled out rather than left as the bare word "default": a
 * control that says "ברירת מחדל" and nothing else makes you go and look up
 * what the default is, which is the one thing the control could have told you.
 */
export function reminderLabel(
  stored: string | null | undefined,
  options: { hasTime: boolean; reminderHour: number; defaultLead: number },
): string {
  if (isReminderOff(stored)) return 'בלי תזכורת';

  if (stored === null || stored === undefined) {
    return options.hasTime
      ? `ברירת מחדל · ${options.defaultLead} דק׳ לפני`
      : `ברירת מחדל · ${hourLabel(options.reminderHour)}`;
  }

  const named = REMINDER_OPTIONS.find((option) => option.value === stored);
  if (named) return named.label;

  const minutes = reminderLead(stored);
  return minutes === null ? 'ברירת מחדל' : `${minutes} דקות לפני`;
}

/** 8 → "08:00". */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export interface FireAtInput {
  /** UTC midnight of the scheduled day, as stored. Null means unscheduled. */
  scheduledFor: Date | null;
  /** "HH:mm", or null. */
  scheduledTime: string | null;
  /** `Task.reminder` as stored. */
  reminder: string | null;
  /** `User.reminderHour`. */
  reminderHour: number;
  /** The lead applied when a timed task says nothing of its own. */
  defaultLead: number;
}

/**
 * The instant a reminder should be delivered, or null if there is none.
 *
 * Null covers every "nothing to send" case: no day, switched off, or a time
 * that cannot be read. An unscheduled task has no anchor at all — a reminder
 * needs a day before it can need an hour.
 */
export function reminderFireAt(input: FireAtInput): Date | null {
  if (!input.scheduledFor) return null;
  if (isReminderOff(input.reminder)) return null;

  const hasTime = Boolean(input.scheduledTime);
  const at = wallTimeInstant(input.scheduledFor, input.scheduledTime ?? hourLabel(input.reminderHour));
  if (!at) return null;
  const anchor = at.getTime();

  // A task with no time has no "before" worth honouring — the anchor is
  // already an arbitrary hour someone chose, so shifting it by ten minutes
  // would be precision about nothing. Only a whole day earlier is meaningful.
  const explicit = reminderLead(input.reminder);
  const lead =
    explicit !== null
      ? hasTime || explicit >= 1440
        ? explicit
        : 0
      : hasTime
        ? input.defaultLead
        : 0;

  return new Date(anchor - lead * 60_000);
}
