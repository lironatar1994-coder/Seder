import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { getSidebarData } from '@/server/tasks/queries';
import { getFilteredTasks } from '@/server/tasks/filters';
import { FILTER_PRESETS, filterFromSearch, isFilterResultSearch, taskFilterSchema } from '@/lib/task-filters';
import { ViewHeader } from '@/components/nav/view-header';
import { FilterBuilder } from '@/components/task/filter-builder';
import { TaskList } from '@/components/task/task-list';
import { FilterDirectory } from '@/components/task/filter-directory';

export const metadata = { title: 'מסננים ותוויות · סדר' };
export default async function FiltersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(); const params = await searchParams;
  const sidebar = await getSidebarData(user.id);
  if (!params.id && params.new !== '1' && !isFilterResultSearch(params)) return <><ViewHeader title="מסננים ותוויות" /><FilterDirectory data={sidebar} /></>;
  let filter = filterFromSearch(params); let name = params.new === '1' ? 'מסנן חדש' : 'תוצאות המסנן';
  if (params.id) {
    const saved = await db.savedFilter.findFirst({ where: { id: params.id, userId: user.id } });
    if (!saved) notFound();
    try { filter = taskFilterSchema.parse(JSON.parse(saved.config)); } catch { notFound(); }
    name = saved.name;
  }
  const data = params.new === '1' ? null : await getFilteredTasks(user.id, filter);
  const preset = FILTER_PRESETS.find((item) => item.id === params.preset);
  return <><Link href="/app/filters" className="filter-back"><ChevronRight className="size-4" aria-hidden />מסננים ותוויות</Link><ViewHeader title={params.id ? name : preset?.name ?? name} subtitle={data ? data.count === 1 ? 'משימה אחת מתאימה' : `${data.count} משימות מתאימות` : 'בחירת התנאים למשימות שיופיעו ברשימה.'} /><FilterBuilder key={`${params.id ?? ''}:${params.new ?? ''}:${JSON.stringify(filter)}`} filter={filter} projects={sidebar.projects} savedId={params.id} initiallyOpen={params.new === '1'} />{data && <><TaskList groups={[{ key: 'filtered', title: null, tasks: data.tasks }]} context={{ view: 'filters' }} projects={sidebar.projects} labels={sidebar.labels} reorderable={false} showTools={false} empty={{ title: 'אין משימות שמתאימות למסנן', body: 'אפשר לשנות את התנאים דרך ״עריכת מסנן״.' }} />{data.count > data.tasks.length && <p className="mb-12 text-sm text-muted">מוצגות 500 המשימות הראשונות. אפשר לצמצם את המסנן.</p>}</>}</>;
}
