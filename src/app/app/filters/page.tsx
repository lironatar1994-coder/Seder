import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { getSidebarData } from '@/server/tasks/queries';
import { getFilteredTasks } from '@/server/tasks/filters';
import { FILTER_PRESETS, filterFromSearch, taskFilterSchema } from '@/lib/task-filters';
import { ViewHeader } from '@/components/nav/view-header';
import { FilterBuilder } from '@/components/task/filter-builder';
import { TaskList } from '@/components/task/task-list';

export const metadata = { title: 'מסננים · סדר' };
export default async function FiltersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(); const params = await searchParams;
  let filter = filterFromSearch(params); let name = 'מסננים';
  if (params.id) {
    const saved = await db.savedFilter.findFirst({ where: { id: params.id, userId: user.id } });
    if (!saved) notFound();
    try { filter = taskFilterSchema.parse(JSON.parse(saved.config)); } catch { notFound(); }
    name = saved.name;
  }
  const [data, sidebar] = await Promise.all([getFilteredTasks(user.id, filter), getSidebarData(user.id)]);
  const preset = FILTER_PRESETS.find((item) => item.id === params.preset);
  return <><ViewHeader title={params.id ? name : preset?.name ?? name} subtitle={`${data.count} משימות מתאימות`} /><FilterBuilder filter={filter} projects={sidebar.projects} savedId={params.id} activePreset={params.preset ?? (!params.id && Object.keys(params).length === 0 ? 'all' : undefined)} /><TaskList groups={[{ key: 'filtered', title: null, tasks: data.tasks }]} context={{ view: 'filters' }} projects={sidebar.projects} labels={sidebar.labels} reorderable={false} showTools={false} empty={{ title: 'אין משימות שמתאימות', body: 'אפשר להרחיב את המסנן או להוסיף משימה חדשה.' }} />{data.count > data.tasks.length && <p className="mb-12 text-sm text-muted">מוצגות 500 המשימות הראשונות. אפשר לצמצם את המסנן.</p>}</>;
}
