'use client';
import { useEffect, useState } from 'react';
import { Columns3, List, Users } from 'lucide-react';
import type { TaskListProps } from './task-list';
import { TaskList } from './task-list';
import { ProjectBoard } from './project-board';
import { ShareDialog } from '@/components/nav/share-dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { updateNavigation, useNavigationParam } from '@/components/nav/navigation-state';

export function ProjectWorkspace({ projectName, ...props }: TaskListProps & { projectName: string }) {
  const [modeParam, setMode] = useNavigationParam('projectView');
  const mode = modeParam === 'board' ? 'board' : 'list';
  const [sharing, setSharing] = useState(false); const projectId = props.context.projectId!;
  useEffect(() => {
    if (modeParam) return;
    let initial = 'list';
    try { if (!new URLSearchParams(window.location.search).has('task') && localStorage.getItem(`seder-project-${projectId}`) === 'board') initial = 'board'; } catch {}
    // Seed the existing entry, so Back restores the actual starting view.
    updateNavigation({ projectView: initial }, true);
  }, [projectId, modeParam]);
  const collaborators = props.collaborators ?? [];
  function choose(value: 'list' | 'board') { setMode(value); try { localStorage.setItem(`seder-project-${projectId}`, value); } catch {} }
  return <><div className="project-workspace-toolbar"><div role="group" aria-label="תצוגת הפרויקט" className="view-switch"><button type="button" onClick={() => choose('list')} aria-pressed={mode === 'list'}><List className="size-4" aria-hidden />רשימה</button><button type="button" onClick={() => choose('board')} aria-pressed={mode === 'board'}><Columns3 className="size-4" aria-hidden />לוח</button></div><div className="flex items-center gap-3"><div className="hidden items-center -space-x-1.5 md:flex" aria-label={`${collaborators.length} משתתפים`}>{collaborators.slice(0, 4).map((person) => <Avatar key={person.id} name={person.name} size="sm" decorative />)}</div><Button variant="secondary" size="sm" onClick={() => setSharing(true)}><Users className="size-4" aria-hidden />שיתוף הפרויקט</Button></div></div><ShareDialog projectId={projectId} projectName={projectName} open={sharing} onOpenChange={setSharing} />{mode === 'list' ? <div className="max-w-[48rem]"><TaskList {...props} /></div> : <ProjectBoard groups={props.groups} projectId={projectId} projects={props.projects} labels={props.labels} collaborators={collaborators} />}</>;
}
