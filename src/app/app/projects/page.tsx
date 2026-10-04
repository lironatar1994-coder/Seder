import Link from 'next/link';
import { FolderKanban, Plus, Users, ArrowUpLeft } from 'lucide-react';
import { requireUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { getSidebarData } from '@/server/tasks/queries';
import { ViewHeader } from '@/components/nav/view-header';
import { NewProjectDialog } from '@/components/nav/new-project-dialog';
import { Button } from '@/components/ui/button';
import { swatchVar } from '@/lib/constants';

export const metadata = { title: 'פרויקטים · סדר' };
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireUser(); const { scope } = await searchParams; const sidebar = await getSidebarData(user.id);
  const projects = sidebar.projects.filter((project) => scope !== 'shared' || project.joined || project.memberCount > 0);
  const completed = await db.task.groupBy({ by: ['projectId'], where: { projectId: { in: projects.map((project) => project.id) }, parentId: null, status: 'DONE' }, _count: { _all: true } });
  const done = new Map(completed.map((item) => [item.projectId, item._count._all]));
  return <div data-wide><ViewHeader title="הפרויקטים שלי" subtitle="מטרות גדולות, צעדים קטנים. לבד או ביחד." action={<NewProjectDialog trigger={<Button size="sm"><Plus className="size-4" aria-hidden />פרויקט חדש</Button>} />} /><nav aria-label="סינון פרויקטים" className="mb-6 flex gap-2"><Link href="/app/projects" className={`filter-chip ${scope !== 'shared' ? 'filter-chip-active' : ''}`}>כל הפרויקטים</Link><Link href="/app/projects?scope=shared" className={`filter-chip ${scope === 'shared' ? 'filter-chip-active' : ''}`}><Users className="size-3.5" aria-hidden />משותפים</Link></nav><div className="project-directory">{projects.map((project) => { const finished = done.get(project.id) ?? 0; const total = finished + project.openCount; return <Link key={project.id} href={`/app/project/${project.id}`} className="project-directory-item"><div className="flex items-center justify-between gap-3"><FolderKanban className="size-6" style={{ color: swatchVar(project.color) }} aria-hidden /><ArrowUpLeft className="size-4 text-muted" aria-hidden /></div><h2 className="mt-6 truncate text-xl font-bold" dir="auto">{project.name}</h2><p className="mt-1 text-sm text-muted"><span className="num">{project.openCount}</span> משימות פתוחות</p><div className="project-directory-progress" aria-hidden><span style={{ width: `${total ? finished / total * 100 : 0}%`, backgroundColor: swatchVar(project.color) }} /></div><div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted"><span>{total ? `${finished} מתוך ${total} הושלמו` : 'מוכנים לצעד הראשון'}</span>{project.memberCount > 0 || project.joined ? <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden />משותף</span> : <span>פרטי</span>}</div></Link>; })}</div>{projects.length === 0 && <div className="py-16 text-center"><Users className="mx-auto size-9 text-muted" aria-hidden /><h2 className="mt-4 text-xl font-bold">עוד אין פרויקטים משותפים</h2><p className="mt-2 text-muted">נכנסים לפרויקט ולוחצים על ״שיתוף הפרויקט״ כדי להזמין חברים.</p></div>}</div>;
}
