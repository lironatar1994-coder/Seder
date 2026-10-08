'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowUp, Check, Folder, Inbox, MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { parseQuickAdd, type ParsedToken, type TokenKind } from '@/lib/quick-add-parser';
import { quickAddAction, type QuickAddContext } from '@/server/tasks/actions';
import { useToast } from '@/components/ui/toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { DatePickerPanel, type WhenValue } from '@/components/calendar/date-picker';
import { relativeDayLabel, today } from '@/lib/dates';
import { dateTone, schedulePresentation } from '@/lib/date-presentation';
import { useTaskNow } from './task-clock';
import { quickAddSchedule, quickAddReschedulePreset, reconcileQuickAddSelection, withoutQuickAddTokens, type QuickAddSelection } from '@/lib/quick-add-selection';
import { ComposerProperties } from './composer-properties';
import { useComposerPreferences } from './composer-preferences';
import { COMPOSER_FIELD_DETAILS } from './composer-fields';
import { COMPOSER_FIELDS, type ComposerField } from '@/lib/composer-preferences';
import { PRIORITY_LABELS } from '@/lib/constants';
import { describeStored } from '@/lib/recurrence';

export interface ComposerProject { id: string; name: string; color: string }

/** Picker keys belong to the picker, not the task list/calendar behind it.
 * Escape must be stopped during Radix's capture callback, before dismissal
 * unmounts the portal and its ordinary bubbling handler. */
function stopPickerKey(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

/**
 * A resolved token is coloured like the thing it will produce. `!1` is a red
 * flag on the saved row, so it is red here too — an accent-blue "עדיפות 1"
 * previews the wrong task.
 */
function tokenColours(token: ParsedToken): { bg: string; fg: string } {
  // A wash rather than one of the `-soft` tokens: this layer sits over the
  // field, and a solid fill would hide the caret whenever it stood inside a
  // token. Both land within a shade of `--accent-soft` on either theme.
  const wash = (colour: string) => `color-mix(in oklab, var(${colour}) 14%, transparent)`;

  if (token.kind === 'deadline') return { bg: wash('--flag'), fg: 'var(--flag)' };
  if (token.kind === 'priority') {
    // "!1" / "p1" — priority 4 is the default and carries no colour of its own.
    const level = token.raw.replace(/\D/g, '');
    if (level === '1' || level === '2' || level === '3') {
      return { bg: wash(`--p${level}`), fg: `var(--p${level})` };
    }
  }
  return { bg: wash('--accent'), fg: 'var(--accent)' };
}

interface Segment {
  key: string;
  text: string;
  token?: ParsedToken;
}

/** The typed string, cut into what the parser claimed and what it left alone.
 *  Token spans are keyed by what was understood rather than by where it sits,
 *  so typing a title in front of a finished token does not re-mount it. */
function segment(text: string, tokens: ParsedToken[]): Segment[] {
  const out: Segment[] = [];
  const seen = new Map<string, number>();
  let last = 0;

  for (const token of tokens) {
    if (token.start > last) out.push({ key: `plain-${last}`, text: text.slice(last, token.start) });
    const signature = `${token.kind}:${token.display}`;
    const nth = seen.get(signature) ?? 0;
    seen.set(signature, nth + 1);
    out.push({ key: `token-${signature}-${nth}`, text: text.slice(token.start, token.end), token });
    last = token.end;
  }

  if (last < text.length) out.push({ key: `plain-${last}`, text: text.slice(last) });
  return out;
}

/** Hebrew sentence capture with account-configurable, direct attribute pickers. */
export function Composer({
  context,
  vocabulary,
  projects = [],
  onClose,
  onAdded,
  autoFocus = true,
  variant = 'inline',
}: {
  context: QuickAddContext;
  /** Existing project and label names, so the live highlight matches what the
   *  server will do with multi-word names. */
  vocabulary?: { projects: string[]; labels: string[] };
  projects?: ComposerProject[];
  onClose?: () => void;
  /** Lets a list highlight the saved row in addition to its confirmation. */
  onAdded?: (id: string, landedIn?: string) => void;
  autoFocus?: boolean;
  variant?: 'inline' | 'sheet';
}) {
  const now = useTaskNow();
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<QuickAddSelection>({});
  const [dateOpen, setDateOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState<ComposerField | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<number | null>(null);
  const { toast } = useToast();
  const sheet = variant === 'sheet';
  const preferences = useComposerPreferences();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // React owns the value, so a chip that rewrites the text also has to put the
  // caret back afterwards — otherwise it lands at the end of a string the user
  // was typing in the middle of.
  useEffect(() => {
    if (caretRef.current === null) return;
    inputRef.current?.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  });

  const parsed = useMemo(
    () => parseQuickAdd(text, new Date(), vocabulary),
    [text, vocabulary],
  );
  const chips = useMemo(() => parsed?.tokens ?? [], [parsed]);
  const schedule = quickAddSchedule(parsed, context, selection);
  const scheduleDate = schedule.date ? new Date(`${schedule.date}T00:00:00.000Z`) : null;
  const scheduleStyle = scheduleDate ? schedulePresentation(scheduleDate, schedule.time, now) : null;
  const projectId = selection.projectId !== undefined ? selection.projectId : parsed.projectName
    ? projects.find(project => project.name === parsed.projectName)?.id ?? null : context.projectId ?? null;
  const projectName = selection.projectId !== undefined
    ? projects.find(project => project.id === selection.projectId)?.name
    : parsed.projectName ?? projects.find(project => project.id === context.projectId)?.name;
  const dateLabel = schedule.date ? relativeDayLabel(new Date(`${schedule.date}T00:00:00.000Z`), today())
    : schedule.bucket === 'SOMEDAY' ? 'מתישהו' : 'תאריך';
  const deadline = selection.deadline !== undefined ? selection.deadline : parsed.deadline;
  const priority = selection.priority ?? parsed.priority;
  const labelNames = selection.labelNames ?? parsed.labelNames;
  const recurrence = selection.recurrence !== undefined ? selection.recurrence : parsed.recurrence;
  const hiddenFields = COMPOSER_FIELDS.filter(field => !preferences.fields.includes(field));
  const selectedFields: Record<ComposerField, boolean> = { date: Boolean(schedule.date || schedule.bucket === 'SOMEDAY'), project: Boolean(projectName), priority: priority !== 4, deadline: Boolean(deadline), labels: labelNames.length > 0, repeat: Boolean(recurrence) };
  const extraCount = hiddenFields.filter(field => selectedFields[field]).length;
  const filteredProjects = projects.filter(project => project.name.toLocaleLowerCase().includes(projectSearch.toLocaleLowerCase()));
  const controlClass = 'inline-flex h-9 min-w-0 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-50 [@media(pointer:coarse)]:h-11';
  // Width includes the popover's padding, not just its calendar/list child.
  const pickerClass = 'max-w-[calc(100vw-1.5rem)] [&_[data-testid=date-picker]]:max-w-full [&_[data-testid=composer-properties]]:max-w-full';

  function choose(kinds: TokenKind[], value: Partial<QuickAddSelection>) {
    const next = withoutQuickAddTokens(text, parsed, kinds);
    setText(next);
    setSelection(current => ({ ...current, ...value }));
  }
  function chooseSchedule(value: WhenValue) {
    choose(['date', 'bucket', 'time'], { schedule: value });
    setDateOpen(false);
    setMoreOpen(false);
  }
  function type(value: string) {
    setSelection(current => reconcileQuickAddSelection(parsed, parseQuickAdd(value, new Date(), vocabulary), current));
    setText(value);
  }
  function restoreInput(event: Event) {
    event.preventDefault();
    inputRef.current?.focus();
  }
  const segments = useMemo(() => segment(text, chips), [text, chips]);

  /* Once the text is wider than the field the input scrolls, and the mirror has
     to travel with it. Copying the number across rather than computing one:
     both elements are the same box with the same direction, so whatever
     convention the engine uses for `scrollLeft` in RTL, they share it. */
  function syncScroll() {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (input && mirror) mirror.scrollLeft = input.scrollLeft;
  }

  useEffect(syncScroll, [text]);

  function edit(next: string, caret: number) {
    setText(next);
    caretRef.current = caret;
    inputRef.current?.focus();
  }

  function remove(token: ParsedToken) {
    const next = (text.slice(0, token.start) + text.slice(token.end))
      .replace(/\s{2,}/g, ' ')
      .trim();
    edit(next, next.length);
  }

  function submit() {
    const value = text.trim();
    if (!value || pending) return;

    startTransition(async () => {
      try {
        const result = await quickAddAction(value, { ...context, selection });
        if (!result.ok) {
          toast({ message: result.error ?? 'לא הצלחנו לשמור את המשימה', tone: 'error' });
          return;
        }
        setText('');
        setSelection({});
        inputRef.current?.focus();
        if (onAdded && result.id) onAdded(result.id, result.landedIn);
        toast({ message: result.landedIn ? `נוספה ל${result.landedIn}` : 'נוספה משימה', tone: 'success', group: 'task-create' });
      } catch {
        toast({ message: 'המשימה לא נשמרה. אפשר לנסות שוב.', tone: 'error' });
      }
    });
  }

  const ready = Boolean(parsed?.title) && !pending;

  const datePicker = <DatePickerPanel value={schedule.date} bucket={schedule.bucket} time={schedule.time} preset={quickAddReschedulePreset(parsed, selection)} onPick={chooseSchedule}
    onClear={() => chooseSchedule({ bucket: 'ANYTIME', date: null, time: null })} />;
  function pickProject(id: string | null) { choose(['project'], { projectId: id }); setProjectOpen(false); setMoreOpen(false); setProjectSearch(''); }
  const projectPicker = <>
    <input dir="auto" aria-label="חיפוש פרויקטים" placeholder="חיפוש פרויקט" value={projectSearch} onChange={event => setProjectSearch(event.target.value)} className="mb-2 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink" />
    <div className="max-h-64 overflow-y-auto" role="group" aria-label="פרויקטים">
      <button type="button" aria-pressed={!projectName} onClick={() => pickProject(null)} className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-start text-sm text-ink hover:bg-surface-2"><Inbox className="size-4 text-muted" aria-hidden /><span className="flex-1">תיבה נכנסת</span>{!projectName && <Check className="size-4 text-accent" aria-hidden />}</button>
      {filteredProjects.map(project => <button key={project.id} type="button" aria-pressed={project.id === projectId} onClick={() => pickProject(project.id)} className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-start text-sm text-ink hover:bg-surface-2"><Folder className="size-4 shrink-0 text-muted" aria-hidden /><span dir="auto" className="min-w-0 flex-1 truncate">{project.name}</span>{project.id === projectId && <Check className="size-4 shrink-0 text-accent" aria-hidden />}</button>)}
      {projectSearch && !filteredProjects.length && <p className="px-2 py-3 text-sm text-muted">לא נמצאו פרויקטים</p>}
    </div>
  </>;
  function properties(initialPage: 'root' | ComposerField = 'root') {
    return <ComposerProperties initialPage={initialPage} fields={hiddenFields} datePicker={datePicker} projectPicker={projectPicker} dateLabel={`${dateLabel}${schedule.time ? ` ${schedule.time}` : ''}`} projectName={projectName ?? 'תיבה נכנסת'}
      deadline={deadline ?? null} priority={priority} labels={labelNames} knownLabels={vocabulary?.labels ?? []} recurrence={recurrence} date={schedule.date}
      onDeadline={value => choose(['deadline'], { deadline: value })}
      onPriority={value => choose(['priority'], { priority: value })}
      onLabels={value => choose(['label'], { labelNames: value })}
      onRecurrence={value => choose(['recurrence'], { recurrence: value })}
      onClose={() => { setMoreOpen(false); setPropertyOpen(null); setProjectSearch(''); }} />;
  }
  const fieldValues: Record<ComposerField, string> = {
    date: dateLabel, project: projectName ?? 'תיבה נכנסת',
    priority: priority === 4 ? 'עדיפות' : PRIORITY_LABELS[priority],
    deadline: deadline ? `עד ${relativeDayLabel(new Date(`${deadline}T00:00:00.000Z`))}` : 'מועד הגשה',
    labels: labelNames.length ? `${labelNames[0]}${labelNames.length > 1 ? ` +${labelNames.length - 1}` : ''}` : 'תוויות',
    repeat: describeStored(recurrence) ?? 'חזרה',
  };

  return (
    <form
      onSubmit={(event) => {
        // A time editor is portalled outside this form, but React still bubbles
        // its submit event through the composer. Saving an hour is not Add.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        submit();
      }}
      data-testid="task-composer"
      className={cn(
        sheet
          ? // Flush to the three edges the keyboard already occupies. As a
            // floating card it was a rounded rectangle hovering over a rounded
            // keyboard, and it gave up 16px of field width to say so.
            'rounded-t-2xl border-bs border-line bg-surface px-4 pt-3 shadow-pop' +
              ' pb-[max(1rem,env(safe-area-inset-bottom))]'
          : // `.composer-card` carries the focus glow — see globals.css.
            'composer-card rounded-xl border border-line bg-surface p-3 shadow-row',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          {/* The visible text, over the field rather than under it: a press has
              to be able to reach a token, and the input would otherwise take
              every one of them. The layer itself is transparent to the pointer,
              so anywhere that is not a token still lands a caret — and the
              token fills are washes rather than solids, so the caret and the
              selection carry on showing through from below. */}
          <div
            ref={mirrorRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 flex items-center overflow-hidden"
          >
            <span dir="auto" className="shrink-0 whitespace-pre text-base text-ink">
              {segments.map((seg) => {
                if (!seg.token) return <span key={seg.key}>{seg.text}</span>;
                const { bg, fg } = tokenColours(seg.token);
                const sigil = /^[#@!]/.test(seg.text) ? seg.text.slice(0, 1) : '';
                return (
                  <span
                    key={seg.key}
                    className="qa-token"
                    data-token={seg.token.kind}
                    style={{ '--qa-bg': bg, '--qa-fg': fg } as React.CSSProperties}
                    // The highlight is the only thing on this layer that takes
                    // a press: tapping the word takes it back out of the text.
                    // The old chips taught that gesture, and on a phone the
                    // alternative is landing a caret between two Hebrew words.
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => remove(seg.token!)}
                  >
                    {sigil && <span className="qa-sigil">{sigil}</span>}
                    {sigil ? seg.text.slice(1) : seg.text}
                  </span>
                );
              })}
            </span>
          </div>

          <input
            ref={inputRef}
            dir="auto"
            value={text}
            onChange={(event) => type(event.target.value)}
            onScroll={syncScroll}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                if (text) { setText(''); setSelection({}); }
                else onClose?.();
              }
            }}
            placeholder="מה צריך לעשות?"
            aria-label="משימה חדשה"
            // Chrome offers to fill a bare text field with an address or a card,
            // and puts a bar over the keyboard to do it.
            autoComplete="off"
            enterKeyHint="done"
            className={cn(
              // `block`, so the wrapper is exactly the input's box. Left
              // inline, the wrapper is a line box three pixels taller than the
              // field and the mirror centres itself half a pixel off the text
              // it is standing in for.
              'qa-input relative block w-full bg-transparent text-base text-transparent outline-none',
              '[caret-color:var(--ink)] placeholder:text-muted',
              '[@media(pointer:coarse)]:h-11',
            )}
          />
        </div>

        <button
          type="submit"
          aria-label="הוספה"
          aria-busy={pending}
          disabled={!ready}
          className={cn(
            'grid shrink-0 place-items-center rounded-full transition-[background-color,transform]',
            sheet ? 'size-11' : 'size-9',
            ready
              ? 'bg-accent text-[var(--on-accent)] shadow-row active:scale-95'
              : 'bg-surface-2 text-muted',
          )}
        >
          <ArrowUp className={sheet ? 'size-5' : 'size-4'} strokeWidth={2.75} aria-hidden />
        </button>
      </div>

      {/* The highlight is a colour, and a colour is not readable aloud. This is
          the same parse said in words, for anyone who cannot see the field
          light up — and the only place the priority is still spelled out. */}
      <p aria-live="polite" data-testid="composer-chips" className="sr-only">
        {chips.map((token) => token.display).join(' · ')}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid="composer-controls">
        {preferences.fields.map(field => {
          const { label, icon: FieldIcon } = COMPOSER_FIELD_DETAILS[field];
          const Icon = field === 'project' && !projectName ? Inbox : FieldIcon;
          const open = field === 'date' ? dateOpen : field === 'project' ? projectOpen : propertyOpen === field;
          function setOpen(next: boolean) {
            if (field === 'date') setDateOpen(next);
            else if (field === 'project') { setProjectOpen(next); if (!next) setProjectSearch(''); }
            else setPropertyOpen(next ? field : null);
          }
          const accessible = `בחירת ${label}, ${fieldValues[field]}${field === 'date' && schedule.time ? ` ${schedule.time}` : ''}`;
          return <Popover key={field} open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" disabled={pending} aria-label={accessible} title={accessible} data-composer-field={field}
                data-date-tone={field === 'date' ? scheduleStyle?.dateTone ?? 'none' : field === 'deadline' && deadline ? dateTone(new Date(`${deadline}T00:00:00Z`), now) : undefined}
                className={cn(controlClass, 'max-w-full', preferences.showLabels ? 'max-w-56' : 'justify-center px-2.5')}>
                <Icon className="size-4 shrink-0" style={field === 'priority' && priority !== 4 ? { color: `var(--p${priority})` } : undefined} aria-hidden />
                {preferences.showLabels && <span dir="auto" className="min-w-0 truncate">{fieldValues[field]}</span>}
                {field === 'date' && schedule.time && <span dir="ltr" data-time-overdue={scheduleStyle?.timeOverdue ?? false} className="num shrink-0 text-sm text-muted">{schedule.time}</span>}
                {!preferences.showLabels && field === 'labels' && labelNames.length > 0 && <span className="num text-xs">{labelNames.length}</span>}
                {!preferences.showLabels && field === 'priority' && priority !== 4 && <span className="num text-xs">{priority}</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent aria-label={`${label} המשימה`} className={cn(pickerClass, field === 'project' && 'w-72')} side={sheet ? 'top' : 'bottom'} onCloseAutoFocus={restoreInput} onEscapeKeyDown={stopPickerKey} onKeyDown={stopPickerKey}>
              {field === 'date' ? datePicker : field === 'project' ? projectPicker : properties(field)}
            </PopoverContent>
          </Popover>;
        })}
        <Popover open={moreOpen} onOpenChange={open => { setMoreOpen(open); if (!open) setProjectSearch(''); }}>
          <PopoverTrigger asChild>
            <button type="button" disabled={pending} aria-label={extraCount ? `פרטים נוספים, ${extraCount} נבחרו` : 'פרטים נוספים'} title="פרטים נוספים והתאמת השדות" className={cn(controlClass, 'shrink-0 border-transparent px-2')}>
              <MoreHorizontal className="size-4 shrink-0" aria-hidden />{preferences.showLabels && <span>עוד</span>}
              {extraCount > 0 && <span className="num text-xs text-accent">{extraCount}</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent aria-label="פרטים נוספים למשימה" className={pickerClass} side={sheet ? 'top' : 'bottom'} onCloseAutoFocus={restoreInput} onEscapeKeyDown={stopPickerKey} onKeyDown={stopPickerKey}>
            {properties()}
          </PopoverContent>
        </Popover>
        {!sheet && onClose && <button type="button" aria-label="ביטול" onClick={onClose} className="ms-auto grid size-9 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink [@media(pointer:coarse)]:size-11"><X className="size-4" aria-hidden /></button>}
      </div>
      {text.trim() && !parsed.title && <p className="mt-2 text-xs text-p2">חסר שם למשימה</p>}
    </form>
  );
}
