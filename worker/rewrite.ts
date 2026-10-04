/**
 * The fallback, for messages the parser could not read.
 *
 * The model does **not** produce a task. It rewrites a message into the app's
 * own quick-add syntax and hands that line back to `captureTask`, which parses
 * it with the same parser the web composer uses.
 *
 * That inversion is the whole design. The system this replaces had the model
 * emit `{content, target_date, time, duration}` and wrote those fields to the
 * database directly, which means the model is a second, untested, non-
 * deterministic writer with its own idea of what a task is. Here it is a
 * translator into a language we already validate: whatever it returns still
 * has to survive the parser, so a hallucinated field cannot reach a row.
 *
 * It is also rare. `needsSecondOpinion` only reaches for this when the parser
 * found no timing at all and the message is visibly about time.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/** Long enough for a sentence with a date, short enough that a runaway
 *  response is obviously not a task line. */
const MAX_OUTPUT = 240;
const TIMEOUT_MS = 8_000;

const SYNTAX = [
  'מחר · היום · מחרתיים · יום שלישי · 25.12',
  'בשעה 14:30',
  'עד מחר   (דדליין, להבדיל מתאריך ביצוע)',
  'כל יום · כל יום שני · כל שבוע · כל חודש',
  '#פרויקט',
  '@תווית',
  '!1 עד !4   (1 = דחוף)',
].join('\n');

let client: GoogleGenerativeAI | null = null;

function model() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  client ??= new GoogleGenerativeAI(key);
  // The cheapest model that can do this. It is a translation, not reasoning.
  return client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
}

export function rewriteAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Rewrite a message as one quick-add line, or null if we could not.
 *
 * Null is an ordinary outcome — no key, a timeout, a refusal, anything that
 * does not look like a single task line. The caller falls back to the parser's
 * own reading, which is never worse than what the user typed.
 */
export async function toQuickAddLine(text: string, now: Date): Promise<string | null> {
  const gemini = model();
  if (!gemini) return null;

  const context = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);

  const prompt = [
    'אתה ממיר הודעה חופשית בעברית לשורה אחת בתחביר של אפליקציית משימות.',
    `היום: ${context} (שעון ישראל).`,
    '',
    'התחביר:',
    SYNTAX,
    '',
    'כללים:',
    '- החזר שורה אחת בלבד, בלי הסבר ובלי מרכאות.',
    '- שמור על נוסח המשימה כפי שנכתב; הוסף רק את הסימונים.',
    '- אל תמציא תאריך או שעה שלא נאמרו.',
    '- אם אין מה להוסיף, החזר את ההודעה כמות שהיא.',
    '',
    `ההודעה: ${text}`,
  ].join('\n');

  try {
    const response = await Promise.race([
      gemini.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('gemini timed out')), TIMEOUT_MS),
      ),
    ]);

    const line = clean(response.response.text());
    // An echo is not worth re-parsing — the caller already has that reading.
    return line && line !== text.trim() ? line : null;
  } catch (error) {
    console.error('[whatsapp] rewrite failed:', (error as Error).message);
    return null;
  }
}

/** One line, no fences, no quotes, or nothing. */
function clean(raw: string): string | null {
  let text = raw.trim();

  if (text.startsWith('```')) {
    text = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
  }

  // A model that decided to explain itself gives us several lines. The first
  // non-empty one is the answer often enough to be worth taking, and the
  // length cap below catches it when it is not.
  const [first] = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!first) return null;

  const line = first.replace(/^["'״]|["'״]$/g, '').trim();
  return line && line.length <= MAX_OUTPUT ? line : null;
}
