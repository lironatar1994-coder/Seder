import { z } from 'zod';
import { PRIORITIES, SWATCHES, WHEN_BUCKETS, VIEW_SLUGS, type ViewSlug } from './constants';

/* Error messages are the user-facing copy. They say what went wrong and what
   to do about it, in the interface's voice — never an apology, never vague. */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'צריך כתובת אימייל')
  .email('הכתובת לא נראית תקינה. בדקו את הסימן @ ואת הסיומת')
  .max(254)
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'הסיסמה צריכה שמונה תווים לפחות')
  .max(200, 'הסיסמה ארוכה מדי');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'איך לקרוא לכם?')
  .max(60, 'השם ארוך מדי');

export const viewSlugSchema = z.enum(VIEW_SLUGS as [ViewSlug, ...ViewSlug[]]);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'צריך סיסמה'),
});

/** "YYYY-MM-DD" as it arrives from a date input, or empty for "no date". */
export const dayStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך לא תקין')
  .nullable()
  .optional();

export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'שעה לא תקינה. הפורמט הוא 14:30')
  .nullable()
  .optional();

export const titleSchema = z
  .string()
  .trim()
  .min(1, 'לכל משימה צריך שם')
  .max(500, 'השם ארוך מדי. אפשר להעביר את הפרטים להערות');

export const createTaskSchema = z.object({
  title: titleSchema,
  notes: z.string().max(10_000).nullable().optional(),
  projectId: z.string().cuid().nullable().optional(),
  sectionId: z.string().cuid().nullable().optional(),
  parentId: z.string().cuid().nullable().optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(4),
  whenBucket: z.enum(WHEN_BUCKETS).default('ANYTIME'),
  scheduledFor: dayStringSchema,
  scheduledTime: timeStringSchema,
  deadline: dayStringSchema,
  labelIds: z.array(z.string().cuid()).max(20).default([]),
  recurrence: z.string().max(60).nullable().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().cuid(),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'לפרויקט צריך שם').max(80, 'השם ארוך מדי'),
  color: z.enum(SWATCHES).default('teal'),
});

export const sectionSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().trim().min(1, 'לקטע צריך שם').max(80, 'השם ארוך מדי'),
});

export const labelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'לתווית צריך שם')
    .max(40, 'השם ארוך מדי')
    .regex(/^[^\s@#]+$/, 'שם תווית בלי רווחים ובלי הסימנים @ או #'),
  color: z.enum(SWATCHES).default('slate'),
});

export const prioritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export { PRIORITIES };

/** Flattens a ZodError into `{ field: firstMessage }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
