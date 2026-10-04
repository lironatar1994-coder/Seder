import { z } from 'zod';

export const COMPOSER_FIELDS = ['date', 'project', 'priority', 'deadline', 'labels', 'repeat'] as const;
export type ComposerField = (typeof COMPOSER_FIELDS)[number];

export const composerPreferencesSchema = z.object({
  fields: z.array(z.enum(COMPOSER_FIELDS)).max(COMPOSER_FIELDS.length)
    .refine(fields => new Set(fields).size === fields.length, 'אין לבחור שדה פעמיים'),
  showLabels: z.boolean(),
}).strict();
export type ComposerPreferences = z.infer<typeof composerPreferencesSchema>;

export const DEFAULT_COMPOSER_PREFERENCES: ComposerPreferences = {
  fields: [...COMPOSER_FIELDS],
  showLabels: true,
};

/** Missing or stale preferences keep the complete, discoverable capture row. */
export function readComposerPreferences(stored: string | null | undefined): ComposerPreferences {
  try {
    const parsed = composerPreferencesSchema.safeParse(JSON.parse(stored ?? 'null'));
    if (parsed.success) return parsed.data;
  } catch { /* A bad stored value must not break task capture. */ }
  return { fields: [...COMPOSER_FIELDS], showLabels: true };
}
