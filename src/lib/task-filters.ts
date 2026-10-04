import { z } from 'zod';

export const taskFilterSchema = z.object({
  query: z.string().trim().max(200).default(''),
  priority: z.enum(['all', '1', '2', '3', '4']).default('all'),
  when: z.enum(['all', 'today', 'overdue', 'week', 'undated']).default('all'),
  assignee: z.enum(['all', 'me', 'unassigned']).default('all'),
  scope: z.enum(['all', 'shared']).default('all'),
  projectId: z.string().max(100).default(''),
});
export type TaskFilter = z.infer<typeof taskFilterSchema>;
export const FILTER_PRESETS = [
  { id: 'all', name: 'כל המשימות', description: 'כל מה שפתוח ואפשר לעבוד עליו', config: {} },
  { id: 'important', name: 'עדיפות גבוהה', description: 'המשימות הדחופות והחשובות', config: { priority: '1' } },
  { id: 'overdue', name: 'באיחור', description: 'משימות שהמועד שלהן כבר עבר', config: { when: 'overdue' } },
  { id: 'assigned', name: 'באחריותי', description: 'משימות שהוקצו לכם בפרויקטים', config: { assignee: 'me' } },
  { id: 'unplanned', name: 'בלי תאריך', description: 'משימות שעדיין לא נכנסו לתכנון', config: { when: 'undated' } },
  { id: 'shared', name: 'עבודה משותפת', description: 'המשימות בפרויקטים שמשותפים עם אחרים', config: { scope: 'shared' } },
] as const;

export function filterFromSearch(params: Record<string, string | undefined>): TaskFilter {
  const preset = FILTER_PRESETS.find((item) => item.id === params.preset);
  const supplied = Object.fromEntries(Object.entries(params).filter(([key, value]) => value !== undefined && key in taskFilterSchema.shape));
  const parsed = taskFilterSchema.safeParse({ ...preset?.config, ...supplied });
  return parsed.success ? parsed.data : taskFilterSchema.parse({});
}
