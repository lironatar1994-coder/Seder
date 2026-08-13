import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/server/auth/session';
import { getProjectView, getSidebarData } from '@/server/tasks/queries';
import { swatchVar } from '@/lib/constants';
import { ViewHeader } from '@/components/nav/view-header';
import { TaskList } from '@/components/task/task-list';
import { ProjectMenu } from '@/components/nav/project-menu';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: 'סדר' };
  const { projectId } = await params;
  const data = await getProjectView(user.id, projectId);
  return { title: data ? `${data.project.name} · סדר` : 'סדר' };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { projectId } = await params;
  const [data, sidebar] = await Promise.all([
    getProjectView(user.id, projectId),
    getSidebarData(user.id),
  ]);
  if (!data) notFound();

  const remaining = data.progress.total - data.progress.done;

  return (
    <>
      <ViewHeader
        title={data.project.name}
        accent={swatchVar(data.project.color)}
        /* "Everything is closed" is only true if something was ever open. A
           project with no tasks at all had said it too, congratulating the user
           for finishing a list they had just created. */
        subtitle={
          data.progress.total === 0
            ? null
            : remaining === 0
              ? 'הכול סגור בפרויקט הזה.'
              : `${remaining} משימות פתוחות`
        }
        progress={data.progress}
        action={
          <ProjectMenu
            project={data.project}
            joined={data.role !== 'owner'}
            memberCount={data.collaborators.length - 1}
          />
        }
      />
      <TaskList
        groups={data.groups}
        context={{ view: 'project', projectId: data.project.id }}
        projects={sidebar.projects}
        labels={sidebar.labels}
        hideProject
        collaborators={data.collaborators}
        empty={{
          title: 'הפרויקט ריק',
          body: `אין עדיין משימות ב״${data.project.name}״. הוסיפו את הצעד הראשון.`,
        }}
      />
    </>
  );
}
