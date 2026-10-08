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
  { id: 'all', name: 'כל המשימות', description: 'כל המשימות הפתוחות, מכל הפרויקטים', config: {} },
  { id: 'important', name: 'משימות דחופות', description: 'משימות שסומנו בעדיפות דחוף', config: { priority: '1' } },
  { id: 'overdue', name: 'באיחור', description: 'משימות שהמועד שלהן כבר עבר', config: { when: 'overdue' } },
  { id: 'assigned', name: 'באחריותי', description: 'משימות שהוקצו לי בפרויקטים', config: { assignee: 'me' } },
  { id: 'unplanned', name: 'ללא תאריך', description: 'משימות ללא תאריך מתוכנן, גם בתיבה הנכנסת', config: { when: 'undated' } },
  { id: 'shared', name: 'עבודה משותפת', description: 'המשימות בפרויקטים שמשותפים עם אחרים', config: { scope: 'shared' } },
] as const;

export function filterFromSearch(params: Record<string, string | undefined>): TaskFilter {
  const preset = FILTER_PRESETS.find((item) => item.id === params.preset);
  const supplied = Object.fromEntries(Object.entries(params).filter(([key, value]) => value !== undefined && key in taskFilterSchema.shape));
  const parsed = taskFilterSchema.safeParse({ ...preset?.config, ...supplied });
  return parsed.success ? parsed.data : taskFilterSchema.parse({});
}

/** Route/UI state is separate from criteria: an empty applied filter is still
 * a result list, while unrelated task-detail parameters keep the directory. */
export function isFilterResultSearch(params: Record<string, string | undefined>) {
  return Boolean(params.id || params.preset || params.applied === '1' || Object.keys(taskFilterSchema.shape).some(key => params[key] !== undefined));
}

export function describeTaskFilter(filter: TaskFilter, projects: { id: string; name: string }[]) {
  const parts: string[] = [];
  if (filter.query) parts.push(`חיפוש: ${filter.query}`);
  if (filter.priority !== 'all') parts.push(`עדיפות: ${{ '1': 'דחוף', '2': 'חשוב', '3': 'רגיל', '4': 'ללא עדיפות' }[filter.priority]}`);
  if (filter.when !== 'all') parts.push({ today: 'היום ובאיחור', overdue: 'באיחור', week: 'בשבעת הימים הקרובים', undated: 'ללא תאריך מתוכנן' }[filter.when]);
  if (filter.projectId) parts.push(`פרויקט: ${projects.find(project => project.id === filter.projectId)?.name ?? 'לא זמין'}`);
  if (filter.assignee !== 'all') parts.push(filter.assignee === 'me' ? 'באחריותי' : 'ללא אחראי');
  if (filter.scope === 'shared') parts.push('פרויקטים משותפים');
  return parts.length ? parts : ['כל המשימות הפתוחות'];
}
