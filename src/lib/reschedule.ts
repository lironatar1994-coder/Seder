import { addDays, today } from './dates';

export const RESCHEDULE_PRESETS = ['today', 'tomorrow', 'next-week'] as const;
export type ReschedulePreset = typeof RESCHEDULE_PRESETS[number];

/** Re-evaluate the original relative choice from today, not its expired date. */
export function rescheduleDate(preset: string | null | undefined, now = new Date()) {
  const base = today(now);
  if (preset === 'tomorrow') return addDays(base, 1);
  if (preset === 'next-week') return addDays(base, ((7 - base.getUTCDay()) % 7) || 7);
  return base;
}
