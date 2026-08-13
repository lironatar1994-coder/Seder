/** Hebrew natural-language quick-add.
 *
 *  Nothing off the shelf parses Hebrew dates — chrono-node and friends are
 *  English/European only — so this is hand-built. It is a pure function of
 *  (text, today) with no I/O, which is what makes it cheap to test exhaustively.
 *
 *  Recognised, anywhere in the string:
 *    dates      היום · מחר · מחרתיים · יום שלישי · ביום ה׳ · בעוד 3 ימים ·
 *               בעוד שבועיים · שבוע הבא · חודש הבא · 20/8 · 20.8.2026
 *    deadline   עד <date> · דדליין <date>          (Things' separate deadline)
 *    time       בשעה 14:30 · ב-14:30 · 14:30 · בשעה 9
 *    buckets    מתישהו · בכל עת
 *    project    #עבודה
 *    labels     @טלפון
 *    priority   !1 · p1
 *
 *  Everything matched is stripped from the title, so typing
 *  "לסיים מצגת מחר בשעה 14:30 #עבודה !1" saves a task called exactly
 *  "לסיים מצגת".
 */

import { addDays, dateOnly, today as todayFn, toDayStart } from './dates';
import {
  firstOccurrenceOnOrAfter,
  parseRecurrence,
  serializeRecurrence,
  type Recurrence,
} from './recurrence';
import type { Priority, WhenBucket } from './constants';

/** Hebrew letters, Latin letters and digits — used to fake word boundaries,
 *  since JS `\b` treats every Hebrew character as a non-word character. */
const W = '[\\u0590-\\u05FF0-9A-Za-z]';
const NB = `(?<!${W})`; // not preceded by a word character
const NA = `(?!${W})`; // not followed by a word character

export type TokenKind =
  | 'date'
  | 'deadline'
  | 'time'
  | 'bucket'
  | 'project'
  | 'label'
  | 'priority'
  | 'recurrence';

export interface ParsedToken {
  kind: TokenKind;
  /** The exact substring that was consumed. */
  raw: string;
  /** Human-readable value for the composer chip, e.g. "מחר" or "14:30". */
  display: string;
  start: number;
  end: number;
}

/** Names the parser already knows about, so `#טיול ליוון` matches the existing
 *  two-word project instead of stopping at the first space. */
export interface QuickAddVocabulary {
  projects?: readonly string[];
  labels?: readonly string[];
}

export interface ParsedQuickAdd {
  /** The text with every recognised token removed. */
  title: string;
  scheduledFor: string | null;
  scheduledTime: string | null;
  deadline: string | null;
  whenBucket: WhenBucket;
  priority: Priority;
  projectName: string | null;
  labelNames: string[];
  /** Serialised rule from `lib/recurrence.ts`, or null. */
  recurrence: string | null;
  tokens: ParsedToken[];
}

/** The named weekdays, for the recurrence patterns. Saturday is handled apart
 *  because "שבת" has no "יום" prefix in normal speech. */
const WEEKDAY_WORDS = 'ראשון|שני|שלישי|רביעי|חמישי|שישי';

const WEEKDAYS: Record<string, number> = {
  ראשון: 0,
  שני: 1,
  שלישי: 2,
  רביעי: 3,
  חמישי: 4,
  שישי: 5,
  'א': 0,
  'ב': 1,
  'ג': 2,
  'ד': 3,
  'ה': 4,
  'ו': 5,
};

function iso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The next occurrence of `weekday`, never today — "יום שלישי" said on a
 *  Tuesday means next Tuesday, which is what people mean. */
function nextWeekday(base: Date, weekday: number): Date {
  const delta = (weekday - base.getUTCDay() + 7) % 7;
  return addDays(base, delta === 0 ? 7 : delta);
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp: 31.1 + 1 month is the last day of February, not the 3rd of March.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

interface RawMatch {
  start: number;
  end: number;
  kind: TokenKind;
  raw: string;
  display: string;
  value: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A single unquoted word — the fallback when the name is not one we know. */
const SIGIL_WORD = `[\\u0590-\\u05FF\\w][\\u0590-\\u05FF\\w'׳״-]*`;

/** Scanners run in this order; an earlier scanner's span wins any overlap. */
function scan(text: string, base: Date, vocab: QuickAddVocabulary = {}): RawMatch[] {
  const found: RawMatch[] = [];

  const push = (m: RegExpExecArray, kind: TokenKind, value: string, display: string) => {
    found.push({ start: m.index, end: m.index + m[0].length, kind, raw: m[0], value, display });
  };

  const each = (pattern: RegExp, fn: (m: RegExpExecArray) => void) => {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      fn(m);
    }
  };

  /* -- project and labels first: they are unambiguous sigils --------------
     Three passes per sigil, in widening order. Overlap resolution keeps the
     longest match at a given position, so a known two-word project beats the
     single-word fallback that starts at the same place. */
  const sigilPasses = (sigil: string, kind: TokenKind, known: readonly string[] = []) => {
    // 1. Explicitly quoted: #"טיול ליוון" — works before the project exists.
    each(new RegExp(`${NB}${sigil}"([^"\\n]+)"`), (m) => push(m, kind, m[1].trim(), m[1].trim()));

    // 2. A name we already have, longest first so "בית ספר" beats "בית".
    for (const name of [...known].filter(Boolean).sort((a, b) => b.length - a.length)) {
      each(new RegExp(`${NB}${sigil}(${escapeRegex(name)})${NA}`, 'i'), (m) =>
        push(m, kind, name, name),
      );
    }

    // 3. Anything else: a single word.
    each(new RegExp(`${NB}${sigil}(${SIGIL_WORD})`), (m) => push(m, kind, m[1], m[1]));
  };

  sigilPasses('#', 'project', vocab.projects);
  sigilPasses('@', 'label', vocab.labels);

  /* -- priority ----------------------------------------------------------- */
  each(new RegExp(`${NB}!([1-4])${NA}`), (m) => push(m, 'priority', m[1], `עדיפות ${m[1]}`));
  each(new RegExp(`${NB}[pP]([1-4])${NA}`), (m) => push(m, 'priority', m[1], `עדיפות ${m[1]}`));

  /* -- time --------------------------------------------------------------- */
  // "בשעה 14:30", "ב-14:30", or a bare "14:30".
  each(/(?:בשעה\s+|ב[-־]\s*)?(\d{1,2}):([0-5]\d)(?![\d:])/g, (m) => {
    const h = Number(m[1]);
    if (h > 23) return;
    const value = `${String(h).padStart(2, '0')}:${m[2]}`;
    push(m, 'time', value, value);
  });
  // "בשעה 9" — hour only, no colon.
  each(new RegExp(`בשעה\\s+(\\d{1,2})${NA}(?!:)`), (m) => {
    const h = Number(m[1]);
    if (h > 23) return;
    const value = `${String(h).padStart(2, '0')}:00`;
    push(m, 'time', value, value);
  });

  /* -- recurrence ---------------------------------------------------------
     Scanned before the plain date phrases so "כל יום שני" is read as a weekly
     rule rather than as the single next Monday. */
  const pushRule = (m: RegExpExecArray, rule: Recurrence, display: string) =>
    push(m, 'recurrence', serializeRecurrence(rule), display);

  each(new RegExp(`${NB}כל\\s+יום\\s+(${WEEKDAY_WORDS})${NA}`), (m) =>
    pushRule(m, { kind: 'weekly', interval: 1, weekdays: [WEEKDAYS[m[1]]] }, `כל יום ${m[1]}`),
  );
  each(new RegExp(`${NB}כל\\s+(${WEEKDAY_WORDS})\\s+ו(${WEEKDAY_WORDS})${NA}`), (m) =>
    pushRule(
      m,
      { kind: 'weekly', interval: 1, weekdays: [WEEKDAYS[m[1]], WEEKDAYS[m[2]]] },
      `כל ${m[1]} ו${m[2]}`,
    ),
  );
  each(new RegExp(`${NB}כל\\s+(${WEEKDAY_WORDS})${NA}`), (m) =>
    pushRule(m, { kind: 'weekly', interval: 1, weekdays: [WEEKDAYS[m[1]]] }, `כל ${m[1]}`),
  );
  each(new RegExp(`${NB}כל\\s+שבת${NA}`), (m) =>
    pushRule(m, { kind: 'weekly', interval: 1, weekdays: [6] }, 'כל שבת'),
  );
  each(new RegExp(`${NB}כל\\s+יום\\s+עבודה${NA}`), (m) =>
    pushRule(m, { kind: 'weekly', interval: 1, weekdays: [0, 1, 2, 3, 4] }, 'כל יום עבודה'),
  );
  each(new RegExp(`${NB}כל\\s+יומיים${NA}`), (m) =>
    pushRule(m, { kind: 'daily', interval: 2 }, 'כל יומיים'),
  );
  each(new RegExp(`${NB}כל\\s+(\\d{1,3})\\s+ימים${NA}`), (m) =>
    pushRule(m, { kind: 'daily', interval: Number(m[1]) }, `כל ${m[1]} ימים`),
  );
  each(new RegExp(`${NB}כל\\s+יום${NA}`), (m) =>
    pushRule(m, { kind: 'daily', interval: 1 }, 'כל יום'),
  );
  each(new RegExp(`${NB}כל\\s+שבועיים${NA}`), (m) =>
    pushRule(m, { kind: 'weekly', interval: 2, weekdays: [] }, 'כל שבועיים'),
  );
  each(new RegExp(`${NB}כל\\s+(\\d{1,2})\\s+שבועות${NA}`), (m) =>
    pushRule(m, { kind: 'weekly', interval: Number(m[1]), weekdays: [] }, `כל ${m[1]} שבועות`),
  );
  each(new RegExp(`${NB}כל\\s+שבוע${NA}`), (m) =>
    pushRule(m, { kind: 'weekly', interval: 1, weekdays: [] }, 'כל שבוע'),
  );
  each(new RegExp(`${NB}כל\\s+חודשיים${NA}`), (m) =>
    pushRule(m, { kind: 'monthly', interval: 2, day: base.getUTCDate() }, 'כל חודשיים'),
  );
  each(new RegExp(`${NB}כל\\s+(\\d{1,2})\\s+חודשים${NA}`), (m) =>
    pushRule(
      m,
      { kind: 'monthly', interval: Number(m[1]), day: base.getUTCDate() },
      `כל ${m[1]} חודשים`,
    ),
  );
  each(new RegExp(`${NB}כל\\s+חודש${NA}`), (m) =>
    pushRule(m, { kind: 'monthly', interval: 1, day: base.getUTCDate() }, 'כל חודש'),
  );
  each(new RegExp(`${NB}כל\\s+שנה${NA}`), (m) =>
    pushRule(
      m,
      { kind: 'yearly', interval: 1, month: base.getUTCMonth() + 1, day: base.getUTCDate() },
      'כל שנה',
    ),
  );

  /* -- buckets ------------------------------------------------------------ */
  each(new RegExp(`${NB}מתישהו${NA}`), (m) => push(m, 'bucket', 'SOMEDAY', 'מתישהו'));
  each(new RegExp(`${NB}בכל\\s+עת${NA}`), (m) => push(m, 'bucket', 'ANYTIME', 'בכל עת'));

  /* -- dates -------------------------------------------------------------- */
  // A "עד"/"דדליין" prefix turns any date into a deadline rather than a
  // schedule. Captured as an optional group so the span swallows the prefix.
  const DUE = `(?:(עד|דדליין)\\s+)?`;

  const pushDate = (m: RegExpExecArray, date: Date, display: string) => {
    const isDeadline = Boolean(m[1]);
    push(m, isDeadline ? 'deadline' : 'date', iso(date), isDeadline ? `עד ${display}` : display);
  };

  each(new RegExp(`${NB}${DUE}(היום)${NA}`), (m) => pushDate(m, base, 'היום'));
  each(new RegExp(`${NB}${DUE}(מחרתיים)${NA}`), (m) => pushDate(m, addDays(base, 2), 'מחרתיים'));
  each(new RegExp(`${NB}${DUE}(מחר)${NA}`), (m) => pushDate(m, addDays(base, 1), 'מחר'));

  // "יום שלישי", "ביום ג׳", "בשבת"
  each(
    new RegExp(
      `${NB}${DUE}(?:ב?יום\\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי)${NA}`,
    ),
    (m) => {
      const day = WEEKDAYS[m[2]];
      pushDate(m, nextWeekday(base, day), `יום ${m[2]}`);
    },
  );
  each(new RegExp(`${NB}${DUE}ב?יום\\s+([אבגדהו])[׳']${NA}`), (m) => {
    const day = WEEKDAYS[m[2]];
    pushDate(m, nextWeekday(base, day), `יום ${m[2]}׳`);
  });
  each(new RegExp(`${NB}${DUE}ב?שבת${NA}`), (m) => pushDate(m, nextWeekday(base, 6), 'שבת'));

  // "בעוד יומיים", "בעוד 3 ימים", "בעוד שבועיים", "בעוד 2 שבועות", "בעוד חודש"
  each(new RegExp(`${NB}${DUE}בעוד\\s+יומיים${NA}`), (m) =>
    pushDate(m, addDays(base, 2), 'בעוד יומיים'),
  );
  each(new RegExp(`${NB}${DUE}בעוד\\s+שבועיים${NA}`), (m) =>
    pushDate(m, addDays(base, 14), 'בעוד שבועיים'),
  );
  each(new RegExp(`${NB}${DUE}בעוד\\s+(\\d{1,3})\\s+ימים${NA}`), (m) =>
    pushDate(m, addDays(base, Number(m[2])), `בעוד ${m[2]} ימים`),
  );
  each(new RegExp(`${NB}${DUE}בעוד\\s+(\\d{1,2})\\s+שבועות${NA}`), (m) =>
    pushDate(m, addDays(base, Number(m[2]) * 7), `בעוד ${m[2]} שבועות`),
  );
  each(new RegExp(`${NB}${DUE}בעוד\\s+שבוע${NA}`), (m) =>
    pushDate(m, addDays(base, 7), 'בעוד שבוע'),
  );
  each(new RegExp(`${NB}${DUE}בעוד\\s+חודש${NA}`), (m) =>
    pushDate(m, addMonths(base, 1), 'בעוד חודש'),
  );

  // "שבוע הבא" → the coming Sunday, since the Israeli week starts on Sunday.
  each(new RegExp(`${NB}${DUE}ב?שבוע\\s+הבא${NA}`), (m) =>
    pushDate(m, nextWeekday(base, 0), 'שבוע הבא'),
  );
  each(new RegExp(`${NB}${DUE}ב?חודש\\s+הבא${NA}`), (m) =>
    pushDate(m, addMonths(base, 1), 'חודש הבא'),
  );

  // Numeric: 20/8, 20.8, 20/08/2026. Day-first — never month-first.
  each(
    new RegExp(`${NB}${DUE}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?${NA}`),
    (m) => {
      const day = Number(m[2]);
      const month = Number(m[3]);
      if (day < 1 || day > 31 || month < 1 || month > 12) return;
      let year = m[4] ? Number(m[4]) : base.getUTCFullYear();
      if (m[4] && year < 100) year += 2000;
      let date = dateOnly(year, month, day);
      // A bare day/month already past this year means next year.
      if (!m[4] && date.getTime() < base.getTime()) date = dateOnly(year + 1, month, day);
      pushDate(m, date, m[4] ? `${day}.${month}.${year}` : `${day}.${month}`);
    },
  );

  return found;
}

export function parseQuickAdd(
  input: string,
  now: Date = new Date(),
  vocab: QuickAddVocabulary = {},
): ParsedQuickAdd {
  const base = toDayStart(todayFn(now));
  const text = input;

  const matches = scan(text, base, vocab).sort((a, b) => a.start - b.start || b.end - a.end);

  // Resolve overlaps: keep the first match, drop anything intersecting it.
  const kept: RawMatch[] = [];
  let cursor = -1;
  for (const m of matches) {
    if (m.start < cursor) continue;
    kept.push(m);
    cursor = m.end;
  }

  let scheduledFor: string | null = null;
  let scheduledTime: string | null = null;
  let deadline: string | null = null;
  let bucket: WhenBucket | null = null;
  let priority: Priority = 4;
  let projectName: string | null = null;
  let recurrence: string | null = null;
  const labelNames: string[] = [];

  for (const m of kept) {
    switch (m.kind) {
      case 'date':
        scheduledFor ??= m.value;
        break;
      case 'deadline':
        deadline ??= m.value;
        break;
      case 'time':
        scheduledTime ??= m.value;
        break;
      case 'bucket':
        bucket ??= m.value as WhenBucket;
        break;
      case 'priority':
        priority = Number(m.value) as Priority;
        break;
      case 'project':
        projectName ??= m.value;
        break;
      case 'recurrence':
        recurrence ??= m.value;
        break;
      case 'label':
        if (!labelNames.includes(m.value)) labelNames.push(m.value);
        break;
    }
  }

  // Build the title from everything that was not consumed.
  let title = '';
  let last = 0;
  for (const m of kept) {
    title += text.slice(last, m.start);
    title += ' ';
    last = m.end;
  }
  title += text.slice(last);
  title = title.replace(/\s+/g, ' ').trim();

  // A time with no day means today — "בשעה 14:30" on its own is about today.
  if (scheduledTime && !scheduledFor) scheduledFor = iso(base);

  // A repeating task has to start somewhere. "כל יום שני" typed on a Wednesday
  // begins on the coming Monday; typed on a Monday it begins today.
  if (recurrence && !scheduledFor) {
    const rule = parseRecurrence(recurrence);
    if (rule) scheduledFor = iso(firstOccurrenceOnOrAfter(rule, base));
  }

  // A date always wins over a bucket word; with neither, the task is simply
  // undated. Where it lives — Inbox or a project — is decided by the caller.
  const whenBucket: WhenBucket = scheduledFor ? 'SCHEDULED' : (bucket ?? 'ANYTIME');

  return {
    title,
    scheduledFor,
    scheduledTime,
    deadline,
    whenBucket,
    priority,
    projectName,
    labelNames,
    recurrence,
    tokens: kept.map(({ kind, raw, display, start, end }) => ({ kind, raw, display, start, end })),
  };
}
