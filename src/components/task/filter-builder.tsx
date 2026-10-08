'use client';
import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BookmarkPlus, ChevronDown, MoreHorizontal, SlidersHorizontal, Trash2 } from 'lucide-react';
import { describeTaskFilter, taskFilterSchema, type TaskFilter } from '@/lib/task-filters';
import { saveFilterAction, deleteFilterAction, updateFilterAction } from '@/server/tasks/filter-actions';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/overlays';
import { useToast } from '@/components/ui/toast';

export function FilterBuilder({ filter, projects, savedId, initiallyOpen = false }: { filter: TaskFilter; projects: { id: string; name: string }[]; savedId?: string; initiallyOpen?: boolean }) {
  const router = useRouter();
  const id = useId();
  const filterForm = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(initiallyOpen);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  return <div className="filter-controls mb-6">
    <div className="filter-toolbar">
      <Button variant="ghost" size="sm" aria-expanded={editing} aria-controls={id} onClick={() => { if (editing) filterForm.current?.reset(); setEditing(!editing); }}><SlidersHorizontal className="size-4" aria-hidden />{editing ? 'סגירת התנאים' : 'עריכת מסנן'}<ChevronDown className="size-3.5" aria-hidden /></Button>
      {!savedId && <Button type="button" size="sm" variant="ghost" aria-expanded={saving} onClick={() => setSaving(!saving)}><BookmarkPlus className="size-4" aria-hidden />שמירת מסנן</Button>}
      {savedId && <Menu><MenuTrigger asChild><IconButton label="אפשרויות המסנן" className="size-11"><MoreHorizontal className="size-5" aria-hidden /></IconButton></MenuTrigger><MenuContent><MenuItem onSelect={() => setSaving(true)}><BookmarkPlus className="size-4" aria-hidden />שמירה כמסנן חדש</MenuItem><MenuItem tone="danger" disabled={pending} onSelect={() => startTransition(async () => { await deleteFilterAction(savedId); router.push('/app/filters'); toast({ message: 'המסנן נמחק' }); })}><Trash2 className="size-4" aria-hidden />מחיקת מסנן</MenuItem></MenuContent></Menu>}
    </div>
    {!editing && <ul aria-label="תנאי המסנן" className="filter-summary">{describeTaskFilter(filter, projects).map(part => <li key={part}>{part}</li>)}</ul>}
    <form id={id} ref={filterForm} hidden={!editing} onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      if (savedId) {
        startTransition(async () => { const result = await updateFilterAction(savedId, Object.fromEntries(data)); if (!result.ok) { toast({ message: result.error ?? 'השינויים לא נשמרו. אפשר לנסות שוב.', tone: 'error' }); return; } setEditing(false); router.refresh(); toast({ message: 'המסנן עודכן' }); });
        return;
      }
      const params = new URLSearchParams({ applied: '1' });
      for (const [key, value] of data) if (typeof value === 'string' && value && value !== 'all') params.set(key, value);
      router.push(`/app/filters?${params}`);
    }} className="filter-builder">
      <label className="filter-field">מילים במשימה<Input name="query" maxLength={200} defaultValue={filter.query} placeholder="חיפוש בשם המשימה או בהערות" /></label>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <label className="filter-field">עדיפות<select name="priority" defaultValue={filter.priority}><option value="all">כל העדיפויות</option><option value="1">דחוף</option><option value="2">חשוב</option><option value="3">רגיל</option><option value="4">ללא עדיפות</option></select></label>
        <label className="filter-field">תאריך<select name="when" defaultValue={filter.when}><option value="all">כל התאריכים</option><option value="today">היום ובאיחור</option><option value="overdue">באיחור</option><option value="week">7 הימים הקרובים</option><option value="undated">ללא תאריך מתוכנן</option></select></label>
        <label className="filter-field">פרויקט<select name="projectId" defaultValue={filter.projectId}><option value="">כל הפרויקטים</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="filter-field">אחריות<select name="assignee" defaultValue={filter.assignee}><option value="all">כל המשימות</option><option value="me">באחריותי</option><option value="unassigned">ללא אחראי</option></select></label>
        <label className="filter-field">סוג הפרויקט<select name="scope" defaultValue={filter.scope}><option value="all">אישי ומשותף</option><option value="shared">משותף בלבד</option></select></label>
      </div>
      <div><Button type="submit" size="sm" disabled={pending}>{pending ? 'שומרים…' : savedId ? 'שמירת שינויים' : 'הצגת משימות'}</Button></div>
    </form>
    {saving && <form className="filter-save-form" onSubmit={event => { event.preventDefault(); startTransition(async () => {
      const current = taskFilterSchema.safeParse(Object.fromEntries(new FormData(filterForm.current!)));
      if (!current.success) { toast({ message: 'יש לבדוק את תנאי המסנן ולנסות שוב.', tone: 'error' }); return; }
      const result = await saveFilterAction(name, current.data);
      if (result.ok) { setSaving(false); router.push(`/app/filters?id=${result.id}`); toast({ message: 'המסנן נשמר ברשימות' }); }
      else toast({ message: result.error ?? 'המסנן לא נשמר. אפשר לנסות שוב.', tone: 'error' });
    }); }}><label className="filter-field min-w-0 flex-1">שם המסנן<Input value={name} onChange={event => setName(event.target.value)} placeholder="למשל: דחוף בעבודה" maxLength={60} autoFocus /></label><Button type="submit" size="sm" disabled={!name.trim() || pending}>{pending ? 'שומרים…' : 'שמירה'}</Button><Button variant="ghost" size="sm" onClick={() => setSaving(false)}>ביטול</Button></form>}
  </div>;
}
