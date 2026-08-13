import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/server/auth/session';
import { getLabelView, getSidebarData } from '@/server/tasks/queries';
import { swatchVar } from '@/lib/constants';
import { ViewHeader } from '@/components/nav/view-header';
import { TaskList } from '@/components/task/task-list';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ labelId: string }>;
}): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: 'סדר' };
  const { labelId } = await params;
  const data = await getLabelView(user.id, labelId);
  return { title: data ? `${data.label.name} · סדר` : 'סדר' };
}

export default async function LabelPage({ params }: { params: Promise<{ labelId: string }> }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { labelId } = await params;
  const [data, sidebar] = await Promise.all([
    getLabelView(user.id, labelId),
    getSidebarData(user.id),
  ]);
  if (!data) notFound();

  return (
    <>
      <ViewHeader
        title={data.label.name}
        accent={swatchVar(data.label.color)}
        subtitle="כל המשימות הפתוחות עם התווית הזאת"
      />
      <TaskList
        groups={data.groups}
        context={{ view: 'label' }}
        projects={sidebar.projects}
        labels={sidebar.labels}
        reorderable={false}
        empty={{
          title: 'אין משימות עם התווית',
          body: `אפשר להוסיף @${data.label.name} לכל משימה כדי שתופיע כאן.`,
        }}
      />
    </>
  );
}
