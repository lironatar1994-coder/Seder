'use client';

import { useState } from 'react';
import { Check, ChevronRight, Flag, Repeat, Tag, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PRIORITIES, PRIORITY_LABELS, type Priority } from '@/lib/constants';
import { relativeDayLabel, today } from '@/lib/dates';
import { describeStored, recurrencePresets } from '@/lib/recurrence';
import { DatePickerPanel } from '@/components/calendar/date-picker';
import { labelSchema } from '@/lib/validation';

type PropertyPage = 'root' | 'deadline' | 'priority' | 'labels' | 'repeat';

/** One overlay, with a back path, keeps optional details off the capture row.
 * Avoid flyout menus on phones: these selectors share the same anchored panel. */
export function ComposerProperties({ deadline, priority, labels, knownLabels, recurrence, date, onDeadline, onPriority, onLabels, onRecurrence, onClose }: {
  deadline: string | null;
  priority: Priority;
  labels: string[];
  knownLabels: string[];
  recurrence: string | null;
  date: string | null;
  onDeadline: (value: string | null) => void;
  onPriority: (value: Priority) => void;
  onLabels: (value: string[]) => void;
  onRecurrence: (value: string | null) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState<PropertyPage>('root');
  const [search, setSearch] = useState('');
  const names = [...new Set([...knownLabels, ...labels])].filter(name => name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const newLabel = search.trim();
  const canCreate = labelSchema.shape.name.safeParse(newLabel).success && ![...knownLabels, ...labels].includes(newLabel);
  const reference = date ? new Date(`${date}T00:00:00.000Z`) : today();
  const titles: Record<PropertyPage, string> = { root: 'פרטים נוספים', deadline: 'מועד הגשה', priority: 'עדיפות', labels: 'תוויות', repeat: 'חזרה' };
  const choose = (action: () => void) => { action(); onClose(); };
  const itemClass = 'flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-start text-sm text-ink hover:bg-surface-2';

  return <div className="w-72" data-testid="composer-properties">
    <div className="mb-2 flex min-h-9 items-center gap-2">
      {page !== 'root' && <button type="button" aria-label="חזרה לפרטים נוספים" onClick={() => setPage('root')} className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2"><ChevronRight className="size-4" aria-hidden /></button>}
      <h3 className="flex-1 text-sm font-semibold text-ink">{titles[page]}</h3>
      <button type="button" aria-label="סגירת פרטים נוספים" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="size-4" aria-hidden /></button>
    </div>
    {page === 'root' && <div>
      <button type="button" onClick={() => setPage('priority')} className={itemClass}><Flag className="size-4 shrink-0" aria-hidden /><span>עדיפות</span><span className="ms-auto truncate text-muted">{PRIORITY_LABELS[priority]}</span></button>
      <button type="button" onClick={() => setPage('deadline')} className={itemClass}><Flag className="size-4 shrink-0" aria-hidden /><span>מועד הגשה</span><span className="ms-auto truncate text-muted">{deadline ? relativeDayLabel(new Date(`${deadline}T00:00:00.000Z`)) : 'ללא'}</span></button>
      <button type="button" onClick={() => setPage('labels')} className={itemClass}><Tag className="size-4 shrink-0" aria-hidden /><span>תוויות</span><span className="ms-auto max-w-36 truncate text-muted">{labels.length ? labels.join(', ') : 'ללא'}</span></button>
      <button type="button" onClick={() => setPage('repeat')} className={itemClass}><Repeat className="size-4 shrink-0" aria-hidden /><span>חזרה</span><span className="ms-auto truncate text-muted">{recurrence ? describeStored(recurrence) : 'ללא'}</span></button>
    </div>}
    {page === 'deadline' && <DatePickerPanel value={deadline} variant="deadline" onPick={value => choose(() => onDeadline(value.date ?? null))} onClear={() => choose(() => onDeadline(null))} />}
    {page === 'priority' && PRIORITIES.map(value => <button key={value} type="button" aria-pressed={value === priority} onClick={() => choose(() => onPriority(value))} className={itemClass}><Flag className="size-4" style={{ color: `var(--p${value})` }} aria-hidden /><span className="flex-1">{PRIORITY_LABELS[value]}</span>{value === priority && <Check className="size-4 text-accent" aria-hidden />}</button>)}
    {page === 'repeat' && <>
      <button type="button" aria-pressed={!recurrence} className={itemClass} onClick={() => choose(() => onRecurrence(null))}><span className="flex-1">ללא חזרה</span>{!recurrence && <Check className="size-4 text-accent" aria-hidden />}</button>
      {recurrencePresets(reference).map(preset => <button key={preset.label} type="button" aria-pressed={preset.value === recurrence} className={itemClass} onClick={() => choose(() => onRecurrence(preset.value))}><span className="flex-1">{preset.label}</span>{preset.value === recurrence && <Check className="size-4 text-accent" aria-hidden />}</button>)}
    </>}
    {page === 'labels' && <div>
      <input aria-label="חיפוש תוויות" dir="auto" value={search} onChange={event => setSearch(event.target.value)} placeholder="חיפוש תווית" className="mb-2 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink" />
      <div className="max-h-60 overflow-y-auto">
        {names.map(name => <button key={name} type="button" aria-pressed={labels.includes(name)} onClick={() => onLabels(labels.includes(name) ? labels.filter(label => label !== name) : [...labels, name])} className={cn(itemClass, labels.includes(name) && 'bg-accent-soft')}><Tag className="size-4 shrink-0 text-muted" aria-hidden /><span dir="auto" className="min-w-0 flex-1 truncate">{name}</span>{labels.includes(name) && <Check className="size-4 text-accent" aria-hidden />}</button>)}
        {canCreate && <button type="button" className={itemClass} onClick={() => { onLabels([...labels, newLabel]); setSearch(''); }}>הוספת ״{newLabel}״</button>}
        {!names.length && !canCreate && <p className="px-2 py-3 text-sm text-muted">{search ? 'לא נמצאו תוויות' : 'אין תוויות עדיין'}</p>}
      </div>
      <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full rounded-lg bg-accent text-sm font-semibold text-[var(--on-accent)]">סיום</button>
    </div>}
  </div>;
}
