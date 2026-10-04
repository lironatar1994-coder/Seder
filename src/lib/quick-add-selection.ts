import { z } from 'zod';
import { WHEN_BUCKETS } from './constants';
import { dayStringSchema, labelSchema, prioritySchema, timeStringSchema } from './validation';
import { today } from './dates';
import { firstOccurrenceOnOrAfter, parseRecurrence, serializeRecurrence } from './recurrence';
import type { ParsedQuickAdd, TokenKind } from './quick-add-parser';

const calendarDay = dayStringSchema.refine(value => {
  if (!value) return true;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'תאריך לא תקין');

/** Picker values are separate from the sentence. Null means an explicit clear;
 * undefined means use the sentence, then the view's default. */
export const quickAddSelectionSchema = z.object({
  schedule: z.object({
    bucket: z.enum(WHEN_BUCKETS),
    date: calendarDay,
    time: timeStringSchema,
  }).refine(value => value.bucket !== 'SCHEDULED' || Boolean(value.date), 'צריך לבחור תאריך').optional(),
  projectId: z.string().cuid().nullable().optional(),
  deadline: calendarDay,
  priority: prioritySchema.optional(),
  labelNames: z.array(labelSchema.shape.name).max(20, 'אפשר לבחור עד 20 תוויות').optional(),
  recurrence: z.string().max(60).refine(value => {
    const rule = parseRecurrence(value);
    return Boolean(rule && serializeRecurrence(rule) === value);
  }, 'חזרה לא תקינה').nullable().optional(),
});

export type QuickAddSelection = z.infer<typeof quickAddSelectionSchema>;
export interface QuickAddDefaults {
  view?: string;
  defaultDate?: string | null;
}

export function quickAddSchedule(
  parsed: ParsedQuickAdd,
  defaults: QuickAddDefaults,
  selection: QuickAddSelection = {},
  now = new Date(),
) {
  if (selection.schedule) {
    const typedDay = parsed.tokens.some(token => token.kind === 'date' || token.kind === 'bucket');
    const typedTime = parsed.tokens.some(token => token.kind === 'time');
    if (typedDay) return {
      bucket: parsed.whenBucket, date: parsed.scheduledFor,
      time: parsed.scheduledFor ? parsed.scheduledTime ?? selection.schedule.time ?? null : null,
    };
    if (typedTime) return {
      bucket: 'SCHEDULED' as const,
      date: selection.schedule.bucket === 'SCHEDULED' ? selection.schedule.date ?? null : parsed.scheduledFor,
      time: parsed.scheduledTime,
    };
    return {
      bucket: selection.schedule.bucket,
      date: selection.schedule.bucket === 'SCHEDULED' ? selection.schedule.date ?? null : null,
      time: selection.schedule.bucket === 'SCHEDULED' ? selection.schedule.time ?? null : null,
    };
  }
  const recurrence = selection.recurrence !== undefined ? selection.recurrence : parsed.recurrence;
  const explicitTiming = parsed.tokens.some(token => ['date', 'bucket', 'time', 'recurrence'].includes(token.kind));
  if (explicitTiming) return { bucket: parsed.whenBucket, date: parsed.scheduledFor, time: parsed.scheduledTime };
  const base = defaults.defaultDate ? new Date(`${defaults.defaultDate}T00:00:00.000Z`) : today(now);
  const rule = parseRecurrence(recurrence);
  if (rule) return { bucket: 'SCHEDULED' as const, date: firstOccurrenceOnOrAfter(rule, base).toISOString().slice(0, 10), time: null };
  if (defaults.defaultDate || defaults.view === 'today') return { bucket: 'SCHEDULED' as const, date: base.toISOString().slice(0, 10), time: null };
  return { bucket: defaults.view === 'someday' ? 'SOMEDAY' as const : 'ANYTIME' as const, date: null, time: null };
}

/** Changing a picker replaces all matching sentence tokens, including duplicates.
 * Other tokens and the task title retain their spelling and order. */
export function withoutQuickAddTokens(text: string, parsed: ParsedQuickAdd, kinds: readonly TokenKind[]) {
  let next = text;
  for (const token of [...parsed.tokens].reverse()) {
    if (kinds.includes(token.kind)) next = next.slice(0, token.start) + next.slice(token.end);
  }
  return next.replace(/\s{2,}/g, ' ').trim();
}

/** A newly typed attribute takes over from its picker. Ordinary title editing
 * must never reset a selected date or project. */
export function reconcileQuickAddSelection(previous: ParsedQuickAdd, next: ParsedQuickAdd, selection: QuickAddSelection): QuickAddSelection {
  const result = { ...selection };
  const changed = (kinds: TokenKind[]) => {
    const tokens = next.tokens.filter(token => kinds.includes(token.kind)).map(token => token.raw).join('\n');
    return tokens !== '' && tokens !== previous.tokens.filter(token => kinds.includes(token.kind)).map(token => token.raw).join('\n');
  };
  // Day and hour are independent: quickAddSchedule overlays typed values on
  // the picked values without copying them into picker state. Deleting a typed
  // time must not leave an invisible, stale hour behind.
  if (changed(['project'])) delete result.projectId;
  if (changed(['deadline'])) delete result.deadline;
  if (changed(['priority'])) delete result.priority;
  if (changed(['label'])) delete result.labelNames;
  if (changed(['recurrence'])) delete result.recurrence;
  return result;
}
