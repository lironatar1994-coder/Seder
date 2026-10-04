'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookmarkPlus, Search, Trash2, SlidersHorizontal } from 'lucide-react';
import { FILTER_PRESETS, taskFilterSchema, type TaskFilter } from '@/lib/task-filters';
import { saveFilterAction, deleteFilterAction } from '@/server/tasks/filter-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

export function FilterBuilder({ filter, projects, savedId, activePreset }: { filter: TaskFilter; projects: { id: string; name: string }[]; savedId?: string; activePreset?: string }) {
  const router = useRouter();
  const filterForm = useRef<HTMLFormElement>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  return <div className="mb-7 space-y-5">
    <nav aria-label="מסננים מהירים" className="flex flex-wrap gap-2">{FILTER_PRESETS.map((preset) => <Link key={preset.id} href={`/app/filters?preset=${preset.id}`} aria-current={activePreset === preset.id ? 'page' : undefined} className={`filter-chip ${activePreset === preset.id ? 'filter-chip-active' : ''}`}>{preset.name}</Link>)}</nav>
    <form ref={filterForm} key={JSON.stringify(filter)} onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const params = new URLSearchParams();
      for (const [key, value] of data) if (typeof value === 'string' && value && value !== 'all') params.set(key, value);
      router.push(`/app/filters?${params}`);
    }} className="filter-builder">
      <div className="flex items-center gap-2"><Search className="size-4 shrink-0 text-muted" aria-hidden /><Input name="query" maxLength={200} aria-label="חיפוש במסנן" defaultValue={filter.query} placeholder="חיפוש לפי שם או הערות" className="border-0 bg-transparent" /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="filter-field">עדיפות<select name="priority" defaultValue={filter.priority}><option value="all">כל העדיפויות</option><option value="1">דחוף</option><option value="2">חשוב</option><option value="3">רגיל</option><option value="4">ללא עדיפות</option></select></label>
        <label className="filter-field">מועד<select name="when" defaultValue={filter.when}><option value="all">כל המועדים</option><option value="today">היום וקודם</option><option value="overdue">באיחור</option><option value="week">השבוע הקרוב</option><option value="undated">ללא תאריך</option></select></label>
        <label className="filter-field">פרויקט<select name="projectId" defaultValue={filter.projectId}><option value="">כל הפרויקטים</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="filter-field">אחריות<select name="assignee" defaultValue={filter.assignee}><option value="all">כולם</option><option value="me">באחריותי</option><option value="unassigned">בלי אחראי</option></select></label>
      </div>
      <input type="hidden" name="scope" value={filter.scope} />
      <div className="flex flex-wrap items-center gap-2"><Button type="submit" size="sm"><SlidersHorizontal className="size-3.5" aria-hidden />הפעלת מסנן</Button><Button type="button" size="sm" variant="ghost" onClick={() => setSaving(!saving)}><BookmarkPlus className="size-4" aria-hidden />שמירת המסנן הזה</Button>{savedId && <Button size="sm" type="button" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { await deleteFilterAction(savedId); router.push('/app/filters'); toast({ message: 'המסנן נמחק' }); })}><Trash2 className="size-3.5" aria-hidden />מחיקת מסנן</Button>}</div>
    </form>
    {saving && <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const current = taskFilterSchema.safeParse(Object.fromEntries(new FormData(filterForm.current!))); if (!current.success) { toast({ message: 'ערכי המסנן לא תקינים', tone: 'error' }); return; } const result = await saveFilterAction(name, current.data); if (result.ok) { setSaving(false); router.push(`/app/filters?id=${result.id}`); toast({ message: 'המסנן נשמר בסרגל' }); } else toast({ message: result.error ?? 'המסנן לא נשמר', tone: 'error' }); }); }}><Input aria-label="שם המסנן" value={name} onChange={(event) => setName(event.target.value)} placeholder="למשל: משימות לשבוע הזה" maxLength={60} autoFocus /><Button type="submit" disabled={!name.trim() || pending}>{pending ? 'שומרים…' : 'שמירה'}</Button></form>}
  </div>;
}
