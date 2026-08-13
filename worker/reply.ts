/**
 * What the app says back over WhatsApp.
 *
 * Pure string building, kept out of the socket module so it can be tested
 * without a WhatsApp connection — the replies are the entire user-visible
 * surface of this feature, and "it silently filed something different from
 * what you asked for" is the failure mode worth guarding.
 *
 * The vocabulary is the app's own: the same day labels, the same recurrence
 * phrasing, the same words for priority. A reply that invented its own terms
 * would teach a second mental model for the same data.
 */

import { formatShortDate, relativeDayLabel, today } from '@/lib/dates';
import { describeStored } from '@/lib/recurrence';
import type { QuickAddResult } from '@/server/tasks/capture';

/** Hebrew temporal words the parser does not handle. If one of these is in the
 *  message and the parser found no timing at all, the message is probably
 *  asking for something we quietly dropped — which is when the LLM earns its
 *  round trip. Deliberately excludes the words the parser *does* read (מחר,
 *  היום, plain weekday names) so a message it handled never pays for a call. */
const TEMPORAL_HINTS =
  /(שבוע הבא|בשבוע הבא|חודש הבא|בעוד|אחרי ה?צהריים|בערב|בבוקר|בלילה|לפנות|סוף השבוע|בסופ"?ש|מחרתיים|עוד יומיים|בקרוב|דחוף|עד ה)/;

/**
 * Should we spend an LLM call trying again?
 *
 * Only when the parser came back with nothing at all about *when* — no date,
 * no time, no deadline, no repeat — and the text is visibly talking about time
 * anyway. A message the parser fully understood never reaches here, which is
 * the difference between this and paying a model to read "לקנות חלב מחר".
 */
export function needsSecondOpinion(text: string, result: QuickAddResult): boolean {
  if (!result.ok || !result.understood) return true;

  const u = result.understood;
  const foundTiming = Boolean(u.scheduledFor || u.scheduledTime || u.deadline || u.recurrence);
  if (foundTiming) return false;

  return TEMPORAL_HINTS.test(text);
}

const PRIORITY_WORDS: Record<number, string> = {
  1: 'דחוף',
  2: 'גבוהה',
  3: 'בינונית',
};

/** The confirmation for a task that was created. */
export function captureReply(result: QuickAddResult): string {
  const u = result.understood;
  if (!u) return 'נוספה משימה.';

  const lines = [`נוספה: *${u.title}*`];
  const base = today();

  if (u.scheduledFor) {
    const day = new Date(`${u.scheduledFor}T00:00:00.000Z`);
    const when = `${relativeDayLabel(day, base)} (${formatShortDate(day)})`;
    lines.push(u.scheduledTime ? `מתי: ${when} בשעה ${u.scheduledTime}` : `מתי: ${when}`);
  } else if (u.scheduledTime) {
    // A time with no day means today — the parser already resolved that, but a
    // caller could still hand us one without a date.
    lines.push(`מתי: היום בשעה ${u.scheduledTime}`);
  }

  if (u.deadline) {
    const due = new Date(`${u.deadline}T00:00:00.000Z`);
    lines.push(`דדליין: ${relativeDayLabel(due, base)} (${formatShortDate(due)})`);
  }

  const repeat = describeStored(u.recurrence);
  if (repeat) lines.push(`חוזר: ${repeat}`);

  if (u.projectName) lines.push(`פרויקט: ${u.projectName}`);
  if (u.labelNames.length) lines.push(`תוויות: ${u.labelNames.join(', ')}`);

  const priority = PRIORITY_WORDS[u.priority];
  if (priority) lines.push(`עדיפות: ${priority}`);

  // Only when there is no date to speak of. With a date, "מתי" above has
  // already answered "where will I find this", and naming the view as well
  // reads as two different answers to one question.
  if (!u.scheduledFor && !u.scheduledTime && result.landedIn) {
    lines.push(`נשמרה ב${result.landedIn}.`);
  }

  return lines.join('\n');
}

/** The reminder that goes out before a scheduled task. */
export function reminderMessage(title: string, time: string): string {
  return `תזכורת: *${title}*\nמתחיל בשעה ${time}.`;
}

/** Past this the list stops being a reminder and starts being a wall. */
const MORNING_MAX = 10;

/**
 * The morning note about today's tasks that carry a date but no time.
 *
 * One message, not one per task. A task with a time has a moment worth
 * interrupting for; a task that is merely "today" does not, and eight of them
 * arriving separately at 08:00 is how a person mutes the number — and how the
 * number spends its daily send budget before nine.
 */
export function morningMessage(titles: string[]): string {
  if (titles.length === 0) return '';
  if (titles.length === 1) return `היום: *${titles[0]}*`;

  const shown = titles.slice(0, MORNING_MAX);
  const rest = titles.length - shown.length;

  const lines = [`היום (${titles.length}):`, ...shown.map((title) => `• ${title}`)];
  if (rest > 0) lines.push(`ועוד ${rest}.`);

  return lines.join('\n');
}

/** Sent once, when someone messages from a number that is set up. */
export function helpMessage(): string {
  return [
    'שולחים הודעה — נפתחת משימה.',
    '',
    'אפשר לכתוב בתוך ההודעה:',
    'מחר · היום · יום שלישי',
    'בשעה 14:30',
    'כל יום שני',
    '#פרויקט',
    '@תווית',
    '!1 לדחוף',
    '',
    'לדוגמה: לסיים מצגת מחר בשעה 14:30 #עבודה !1',
    '',
    '"בטל" מוחק את המשימה האחרונה שנפתחה כאן.',
  ].join('\n');
}

/** Recognised commands, before anything is treated as a task. */
export type Command = 'help' | 'undo' | null;

export function readCommand(text: string): Command {
  const normalized = text.trim().toLowerCase().replace(/[!?.״"']/g, '');

  if (['עזרה', 'help', 'הוראות', 'מה אפשר'].includes(normalized)) return 'help';
  if (['בטל', 'ביטול', 'undo', 'מחק'].includes(normalized)) return 'undo';
  return null;
}
