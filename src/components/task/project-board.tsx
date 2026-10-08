'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, Check, GripVertical, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import type { TaskDTO, TaskGroup } from '@/server/tasks/queries';
import type { Collaborator } from '@/server/access';
import { createSectionAction, renameSectionAction, deleteSectionAction, moveTaskToSectionAction } from '@/server/organization/actions';
import { deleteTaskAction, toggleTaskAction } from '@/server/tasks/actions';
import { relativeDayLabel, today } from '@/lib/dates';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/overlays';
import { useToast } from '@/components/ui/toast';
import { Composer, type ComposerProject } from './composer';
import { TaskDetail } from './task-detail';
import { useNavigationParam, useNavigationTask } from '@/components/nav/navigation-state';

interface Props { groups: TaskGroup[]; projectId: string; projects: { id: string; name: string; color: string }[]; labels: { id: string; name: string; color: string }[]; collaborators: Collaborator[] }
export function ProjectBoard({ groups, projectId, projects, labels, collaborators }: Props) {
  const board = useRef<HTMLDivElement>(null);
  const positioned = useRef(false);
  useEffect(() => {
    if (positioned.current || !board.current) return;
    positioned.current = true;
    const populated = groups.findIndex((group) => group.tasks.length > 0);
    if (window.innerWidth < 768 && populated > 0) {
      // Keep the empty drop target reachable, while opening the phone on work.
      const column = board.current.children.item(populated);
      if (column) {
        const target = column.getBoundingClientRect();
        const frame = board.current.getBoundingClientRect();
        board.current.scrollBy({ left: document.dir === 'rtl' ? target.right - frame.right : target.left - frame.left, behavior: 'instant' });
      }
    }
  }, [groups, projectId]);
  const [openId, setOpenId] = useNavigationParam('task');
  const [newSection, setNewSection] = useState('');
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const task = useNavigationTask(openId, groups.flatMap((group) => group.tasks).find((item) => item.id === openId) ?? null, groups);
  function move(taskId: string, sectionId: string | null) { startTransition(async () => { try { const result = await moveTaskToSectionAction(taskId, projectId, sectionId); if (!result.ok) toast({ message: result.error ?? 'המשימה לא הועברה', tone: 'error' }); } catch { toast({ message: 'ההעברה נכשלה. אפשר לנסות שוב.', tone: 'error' }); } }); }
  function onDragEnd({ active, over }: DragEndEvent) { if (over?.id && over.id !== active.data.current?.section) move(String(active.id), over.id === 'loose' ? null : String(over.id)); }
  return <><DndContext id="seder-board" sensors={sensors} onDragEnd={onDragEnd}><div ref={board} className="project-board" data-testid="project-board" aria-label="לוח הפרויקט" aria-busy={pending}>
    {groups.map((group) => <BoardColumn key={group.key} group={group} projectId={projectId} projects={projects} vocabulary={{ projects: projects.map((project) => project.name), labels: labels.map((label) => label.name) }}>{group.tasks.map((item) => <BoardCard key={item.id} task={item} groupKey={group.key} groups={groups} onOpen={() => setOpenId(item.id)} onMove={(sectionId) => move(item.id, sectionId)} onComplete={() => startTransition(async () => { const result = await toggleTaskAction(item.id, true); if (!result.ok) toast({ message: result.error ?? 'ההשלמה נכשלה', tone: 'error' }); else toast({ message: `הושלם: ${item.title}` }); })} />)}</BoardColumn>)}
    <form className="board-new-section" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await createSectionAction({ projectId, name: newSection }); if (result.ok) setNewSection(''); else toast({ message: result.error ?? 'הקטע לא נוצר', tone: 'error' }); }); }}><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" aria-hidden />קטע חדש</h3><Input aria-label="שם קטע חדש בלוח" placeholder="למשל: בביצוע" value={newSection} onChange={(event) => setNewSection(event.target.value)} maxLength={80} /><Button className="mt-3" size="sm" variant="secondary" type="submit" disabled={!newSection.trim() || pending}>הוספת קטע</Button></form>
  </div></DndContext><TaskDetail task={task} openId={openId} projects={projects} labels={labels} collaborators={collaborators} onClose={() => setOpenId(null)} onDelete={(item) => startTransition(async () => { const result = await deleteTaskAction(item.id); if (result.ok) setOpenId(null); else toast({ message: result.error ?? 'המחיקה נכשלה', tone: 'error' }); })} /></>;
}

function BoardColumn({ group, projectId, projects, vocabulary, children }: { group: TaskGroup; projectId: string; projects: ComposerProject[]; vocabulary: { projects: string[]; labels: string[] }; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: group.key });
  const [adding, setAdding] = useState(false); const [renaming, setRenaming] = useState(false); const [name, setName] = useState(group.title ?? ''); const [deleting, setDeleting] = useState(false); const [pending, startTransition] = useTransition(); const { toast } = useToast();
  return <section ref={setNodeRef} className={`board-column ${isOver ? 'board-column-over' : ''}`} aria-label={group.title ?? 'ללא קטע'}>
    <header className="mb-4 flex items-center gap-2">{renaming ? <form className="flex min-w-0 flex-1 gap-1" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await renameSectionAction(group.key, name); if (result.ok) setRenaming(false); else toast({ message: result.error ?? 'השם לא נשמר', tone: 'error' }); }); }}><Input aria-label="שם הקטע" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus onKeyDown={(event) => { if (event.key === 'Escape') setRenaming(false); }} /><IconButton label="שמירת שם הקטע" type="submit" disabled={pending}><Check className="size-4" aria-hidden /></IconButton></form> : <><h2 className="min-w-0 flex-1 truncate text-base font-bold">{group.title ?? 'ללא קטע'}</h2><span className="num text-xs text-muted">{group.tasks.length}</span>{group.key !== 'loose' && <><IconButton label={`שינוי שם ${group.title}`} onClick={() => { setName(group.title ?? ''); setRenaming(true); }}><Pencil className="size-3.5" aria-hidden /></IconButton><IconButton label={`מחיקת קטע ${group.title}`} onClick={() => setDeleting(true)}><Trash2 className="size-3.5" aria-hidden /></IconButton></>}</>}</header>
    <div className="space-y-3">{children}{group.tasks.length === 0 && <p className="board-empty text-sm text-muted">אפשר לגרור לכאן משימה או להוסיף צעד חדש.</p>}</div>
    {adding ? <div className="mt-3"><Composer context={{ view: 'project', projectId, sectionId: group.key === 'loose' ? null : group.key }} vocabulary={vocabulary} projects={projects} onClose={() => setAdding(false)} /></div> : <button type="button" className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm text-muted hover:bg-surface hover:text-accent" onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden />משימה חדשה</button>}
    <Dialog open={deleting} onOpenChange={setDeleting}><DialogContent title={`מחיקת הקטע ״${group.title}״?`} description="המשימות נשארות בפרויקט ועוברות ל״ללא קטע״."><DialogFooter><Button variant="danger" disabled={pending} onClick={() => startTransition(async () => { const result = await deleteSectionAction(group.key); if (!result.ok) toast({ message: result.error ?? 'המחיקה נכשלה', tone: 'error' }); else setDeleting(false); })}>מחיקת קטע</Button><Button variant="ghost" onClick={() => setDeleting(false)}>ביטול</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}

function BoardCard({ task, groupKey, groups, onOpen, onMove, onComplete }: { task: TaskDTO; groupKey: string; groups: TaskGroup[]; onOpen: () => void; onMove: (sectionId: string | null) => void; onComplete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { section: groupKey } });
  return <article ref={setNodeRef} className={`board-card ${isDragging ? 'board-card-dragging' : ''}`} style={{ transform: CSS.Translate.toString(transform) }} data-testid="board-card">
    <div className="flex items-start gap-2"><button type="button" aria-label={`סימון כהושלם: ${task.title}`} role="checkbox" aria-checked={false} onClick={onComplete} className="mt-1 size-5 shrink-0 rounded-full border-2 hover:border-accent" style={{ borderColor: `var(--p${task.priority})` }} /><button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start text-base font-semibold leading-snug" dir="auto">{task.title}</button><button {...listeners} {...attributes} type="button" aria-label={`גרירת ${task.title}`} className="board-grip -mt-1 flex size-9 shrink-0 touch-none items-center justify-center text-muted"><GripVertical className="size-4" aria-hidden /></button></div>
    {task.notes && <p dir="auto" className="ms-7 mt-2 line-clamp-2 text-sm text-muted">{task.notes}</p>}
    <div className="ms-7 mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">{task.scheduledFor && <span className="flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{relativeDayLabel(task.scheduledFor, today())}</span>}{task.deadline && <span className="text-flag">עד {relativeDayLabel(task.deadline, today())}</span>}{task.subtasks.length > 0 && <span className="num">{task.subtasks.filter((sub) => sub.status !== 'TODO').length}/{task.subtasks.length}</span>}{task.assignee && <span className="ms-auto flex items-center gap-1.5"><Avatar name={task.assignee.name} size="sm" decorative /><bdi>{task.assignee.name}</bdi></span>}</div>
    <label className="mt-3 flex items-center justify-between gap-2 border-bs border-line pt-2 text-xs text-muted"><span>העברה לקטע</span><select className="min-h-9 max-w-[60%] rounded-md bg-surface px-2 text-xs text-ink-2" aria-label={`העברת ${task.title} לקטע`} value={groupKey} onChange={(event) => onMove(event.target.value === 'loose' ? null : event.target.value)}>{groups.map((group) => <option key={group.key} value={group.key}>{group.title ?? 'ללא קטע'}</option>)}</select></label>
  </article>;
}
