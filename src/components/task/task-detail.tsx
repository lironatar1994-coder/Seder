'use client';

import { useEffect, useState, useTransition } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Bell, Check, ChevronDown, ChevronUp, Clock, Flag, Plus, Repeat, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TaskDTO } from '@/server/tasks/queries';
import { PRIORITIES, PRIORITY_LABELS, swatchVar, type Priority } from '@/lib/constants';
import { relativeDayLabel, today } from '@/lib/dates';
import { schedulePresentation } from '@/lib/date-presentation';
import { useTaskNow } from './task-clock';
import { Button, IconButton } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/field';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/overlays';
import { DatePickerPanel } from '@/components/calendar/date-picker';
import { TimePickerPanel } from '@/components/calendar/time-picker';
import {
  isReminderOff,
  reminderLabel,
  reminderOptionsFor,
} from '@/lib/reminder';
import { useReminderDefaults } from './reminder-defaults';
import { describeStored, recurrencePresets } from '@/lib/recurrence';

/** A stored date is UTC midnight, so slicing the ISO string is the calendar
 *  day — `toISOString` on a local-time Date would be off by one. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
import { Avatar } from '@/components/ui/avatar';
import type { Collaborator } from '@/server/access';
import {
  addSubtaskAction,
  assignTaskAction,
  setDeadlineAction,
  setPriorityAction,
  scheduleTaskAction,
  toggleTaskAction,
  updateTaskAction,
} from '@/server/tasks/actions';
import { useToast } from '@/components/ui/toast';
import { TaskComments } from './task-comments';

interface DetailProps {
  /** The task as the surrounding view currently knows it, or null once that
   *  view stops listing it. */
  task: TaskDTO | null;
  /** What the user asked to have open. Kept separate from `task` on purpose —
   *  see the note on `shown` below. */
  openId: string | null;
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  /** Everyone in this task's project — empty unless it is shared, in which
   *  case the rail gains an assignee. */
  collaborators?: Collaborator[];
  /** Moves to the neighbouring task in the list behind the modal. Absent at
   *  the ends, which is what disables the chevrons. */
  onStep?: (direction: -1 | 1) => void;
  canStep?: { prev: boolean; next: boolean };
  onClose: () => void;
  onDelete: (task: TaskDTO) => void;
}

/** The detail sheet enters from the inline-end — the left in Hebrew — so it
 *  never covers the list's reading edge. */
export function TaskDetail({
  task: incoming,
  openId,
  projects,
  labels,
  collaborators = [],
  onStep,
  canStep,
  onClose,
  onDelete,
}: DetailProps) {
  const now = useTaskNow();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  /* Both pickers are controlled so they can close themselves once a date is
     chosen. Left open, the popover sits over whatever control is beneath it —
     and in the rail that is the very next field. Picking a date is a complete
     act; there is nothing further to do in the panel. */
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  /**
   * A local copy of the task, patched the instant the user changes something.
   *
   * Rescheduling from Today to tomorrow removes the task from the Today list,
   * which would otherwise yank this panel out from under the person using it —
   * they set a date and the window they were working in vanishes. Holding the
   * task here keeps the panel open and, because every mutation patches it too,
   * showing the change rather than a stale value.
   */
  const [draft, setDraft] = useState<TaskDTO | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const reminderDefaults = useReminderDefaults();

  useEffect(() => {
    if (incoming) setDraft(incoming);
  }, [incoming]);

  useEffect(() => {
    if (!openId) setDraft(null);
  }, [openId]);

  const task = incoming ?? (draft && draft.id === openId ? draft : null);

  /* Step between tasks without closing, the way Todoist's task view does.
     Triage is the reason this modal is open at all — the alternative is
     close, find the next row, open, six times over. */
  useEffect(() => {
    if (!onStep) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // The title and the notes are text fields inside this very modal, and
      // "j" is a letter before it is a shortcut.
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'j' || event.key === 'J') {
        event.preventDefault();
        onStep!(1);
      } else if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        onStep!(-1);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStep]);

  useEffect(() => {
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
    setNewSubtask('');
    setScheduleOpen(false);
    setTimeOpen(false);
    setDeadlineOpen(false);
    // Reset the editable fields when the panel switches to a different task,
    // not on every refresh of the same one.
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!openId || !task) return null;

  const patch = (changes: Partial<TaskDTO>) =>
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev));

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
    });

  /** UTC midnight of a "YYYY-MM-DD", matching how the server stores dates. */
  const asDate = (value: string | null | undefined) =>
    value ? new Date(`${value}T00:00:00.000Z`) : null;

  const saveTitle = () => {
    const next = title.trim();
    if (!next || next === task.title) {
      setTitle(task.title);
      return;
    }
    run(() => updateTaskAction({ id: task.id, title: next }));
  };

  const saveNotes = () => {
    if (notes === (task.notes ?? '')) return;
    run(() => updateTaskAction({ id: task.id, notes: notes || null }));
  };

  const toggleLabel = (labelId: string) => {
    const current = task.labels.map((l) => l.id);
    const next = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    run(() => updateTaskAction({ id: task.id, labelIds: next }));
  };

  const project = projects.find((p) => p.id === task.projectId) ?? null;
  const scheduleStyle = task.scheduledFor ? schedulePresentation(task.scheduledFor, task.scheduledTime, now, task.status !== 'TODO') : null;
  const shared = collaborators.length > 1;
  const assignee = collaborators.find((c) => c.id === task.assigneeId) ?? null;

  /* Content on one side, settings on the other.

     This used to be a single narrow column, which put the checklist — the
     actual work — underneath six settings, and gave the title the same weight
     as the label above "עדיפות". Todoist splits it the same way and for the
     same reason: what the task *is* belongs together, and what it is *tagged
     with* is a rail beside it.

     On a phone the two stack, with the settings between the notes and the
     checklist rather than after it. Scheduling is the most common reason to
     open a task, and putting it below a checklist of unknown length is how it
     becomes unreachable. */
  const meta = (
    <>
      <MetaRow label="מתוזמן ל">
        <div className="flex items-center gap-1">
        <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" className="flex-1 justify-between" data-date-tone={scheduleStyle?.dateTone ?? 'none'}>
              {task.scheduledFor
                ? relativeDayLabel(task.scheduledFor, today())
                : task.whenBucket === 'ANYTIME'
                  ? 'בכל עת'
                  : task.whenBucket === 'SOMEDAY'
                    ? 'מתישהו'
                    : 'בלי תאריך'}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <DatePickerPanel
              variant="schedule"
              value={task.scheduledFor ? isoDay(task.scheduledFor) : null}
              bucket={task.whenBucket}
              time={task.scheduledTime}
              onPick={(when) => {
                setScheduleOpen(false);
                patch({
                  whenBucket: when.bucket,
                  scheduledFor: when.bucket === 'SCHEDULED' ? asDate(when.date) : null,
                  scheduledTime: when.bucket === 'SCHEDULED' ? when.time ?? null : null,
                });
                run(() =>
                  scheduleTaskAction(task.id, {
                    bucket: when.bucket,
                    date: when.date,
                    time: when.time,
                    preset: when.preset,
                  }),
                );
              }}
              onClear={() => {
                setScheduleOpen(false);
                patch({ whenBucket: 'ANYTIME', scheduledFor: null, scheduledTime: null });
                run(() => scheduleTaskAction(task.id, { bucket: 'ANYTIME' }));
              }}
            />
          </PopoverContent>
        </Popover>
        {task.scheduledFor && <Popover open={timeOpen} onOpenChange={setTimeOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" aria-label={task.scheduledTime ? 'עריכת שעה' : 'הוספת שעה'} data-time-overdue={scheduleStyle?.timeOverdue ?? false} className="shrink-0 gap-1.5 text-muted">
              <Clock className="size-4" aria-hidden />
              {task.scheduledTime ? <span className="num" dir="ltr">{task.scheduledTime}</span> : 'שעה'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <TimePickerPanel time={task.scheduledTime} onSave={time => {
              setTimeOpen(false); patch({ scheduledTime: time });
              run(() => scheduleTaskAction(task.id, { bucket: 'SCHEDULED', date: isoDay(task.scheduledFor!), time }));
            }} onRemove={() => {
              setTimeOpen(false); patch({ scheduledTime: null });
              run(() => scheduleTaskAction(task.id, { bucket: 'SCHEDULED', date: isoDay(task.scheduledFor!), time: null }));
            }} />
          </PopoverContent>
        </Popover>}
        </div>
      </MetaRow>

      {task.scheduledTime && <MetaRow label="משך המשימה">
        <select aria-label="משך המשימה בדקות" value={task.durationMinutes ?? 30} onChange={event => { const durationMinutes = Number(event.target.value); patch({ durationMinutes }); run(() => updateTaskAction({ id: task.id, durationMinutes })); }} className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink">
          {[15, 30, 45, 60, 90, 120].map(minutes => <option key={minutes} value={minutes}>{minutes} דקות</option>)}
          {task.durationMinutes && ![15, 30, 45, 60, 90, 120].includes(task.durationMinutes) && <option value={task.durationMinutes}>{task.durationMinutes} דקות</option>}
        </select>
      </MetaRow>}

      {/* Two separate questions, so two separate controls: when you plan to
          work on it, and when it is actually due. */}
      <MetaRow label="מועד הגשה">
        <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className={cn(
                'w-full justify-between',
                task.deadline && 'border-flag/40 bg-flag-soft text-flag',
              )}
            >
              {task.deadline ? relativeDayLabel(task.deadline, today()) : 'ללא'}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <DatePickerPanel
              variant="deadline"
              value={task.deadline ? isoDay(task.deadline) : null}
              onPick={(when) => {
                setDeadlineOpen(false);
                patch({ deadline: asDate(when.date) });
                run(() => setDeadlineAction(task.id, when.date ?? null));
              }}
              onClear={() => {
                setDeadlineOpen(false);
                patch({ deadline: null });
                run(() => setDeadlineAction(task.id, null));
              }}
            />
          </PopoverContent>
        </Popover>
      </MetaRow>

      {/* Sits under the two date rows because it is about them: a reminder has
          nothing to fire against until the task has a day. */}
      <MetaRow label="תזכורת">
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              disabled={!task.scheduledFor}
              className={cn(
                'w-full justify-between',
                task.scheduledFor &&
                  !isReminderOff(task.reminder) &&
                  task.reminder !== null &&
                  'border-accent/40 bg-accent-soft text-accent',
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Bell className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {task.scheduledFor
                    ? reminderLabel(task.reminder, {
                        hasTime: Boolean(task.scheduledTime),
                        reminderHour: reminderDefaults.hour,
                        defaultLead: reminderDefaults.lead,
                      })
                    : 'צריך תאריך'}
                </span>
              </span>
            </Button>
          </MenuTrigger>
          <MenuContent className="w-60">
            {reminderOptionsFor(Boolean(task.scheduledTime)).map((option) => (
              <MenuItem
                key={option.value ?? 'default'}
                onSelect={() => {
                  patch({ reminder: option.value });
                  run(() => updateTaskAction({ id: task.id, reminder: option.value }));
                }}
              >
                <span className="flex-1">
                  {option.value === null
                    ? reminderLabel(null, {
                        hasTime: Boolean(task.scheduledTime),
                        reminderHour: reminderDefaults.hour,
                        defaultLead: reminderDefaults.lead,
                      })
                    : option.label}
                </span>
                {task.reminder === option.value && (
                  <Check className="size-3.5 text-accent" aria-hidden />
                )}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </MetaRow>

      {shared && (
        <MetaRow label="אחראי">
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="sm" className="w-full justify-between gap-2">
                {assignee ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={assignee.name} size="sm" decorative />
                    <span className="truncate">{assignee.name}</span>
                  </span>
                ) : (
                  <span className="text-muted">פנוי</span>
                )}
              </Button>
            </MenuTrigger>
            <MenuContent className="w-56">
              <MenuItem
                onSelect={() => {
                  patch({ assigneeId: null, assignee: null });
                  run(() => assignTaskAction(task.id, null));
                }}
              >
                <span className="flex-1">בלי אחראי</span>
                {!task.assigneeId && <Check className="size-3.5 text-accent" aria-hidden />}
              </MenuItem>
              {collaborators.map((person) => (
                <MenuItem
                  key={person.id}
                  onSelect={() => {
                    patch({ assigneeId: person.id, assignee: person });
                    run(() => assignTaskAction(task.id, person.id));
                  }}
                >
                  <Avatar name={person.name} size="sm" decorative />
                  <span className="flex-1 truncate">{person.name}</span>
                  {task.assigneeId === person.id && (
                    <Check className="size-3.5 text-accent" aria-hidden />
                  )}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </MetaRow>
      )}

      <MetaRow label="עדיפות">
        <Menu>
          <MenuTrigger asChild>
            <Button variant="secondary" size="sm" className="w-full justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Flag className={cn('size-3.5 shrink-0', PRIORITY_TONE[task.priority])} aria-hidden />
                <span className="truncate">{PRIORITY_LABELS[task.priority]}</span>
              </span>
            </Button>
          </MenuTrigger>
          <MenuContent className="w-52">
            {PRIORITIES.map((p) => (
              <MenuItem
                key={p}
                onSelect={() => {
                  patch({ priority: p });
                  run(() => setPriorityAction(task.id, p));
                }}
              >
                <Flag className={cn('size-3.5', PRIORITY_TONE[p])} aria-hidden />
                <span className="flex-1">{PRIORITY_LABELS[p]}</span>
                {task.priority === p && <Check className="size-3.5 text-accent" aria-hidden />}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </MetaRow>

      <MetaRow label="חזרה">
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className={cn(
                'w-full justify-between',
                task.recurrence && 'border-accent/40 bg-accent-soft text-accent',
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Repeat className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{describeStored(task.recurrence) ?? 'לא חוזרת'}</span>
              </span>
            </Button>
          </MenuTrigger>
          <MenuContent className="w-60">
            <MenuItem
              onSelect={() => {
                patch({ recurrence: null });
                run(() => updateTaskAction({ id: task.id, recurrence: null }));
              }}
            >
              <span className="flex-1">לא חוזרת</span>
              {!task.recurrence && <Check className="size-3.5 text-accent" aria-hidden />}
            </MenuItem>
            <MenuSeparator />
            {/* Anchored to the task's own date, so "כל חודש" means the day it
                is actually scheduled for. */}
            {recurrencePresets(task.scheduledFor ?? today()).map((preset) => (
              <MenuItem
                key={preset.value}
                onSelect={() => {
                  patch({ recurrence: preset.value });
                  run(() => updateTaskAction({ id: task.id, recurrence: preset.value }));
                }}
              >
                <span className="flex-1">{preset.label}</span>
                {task.recurrence === preset.value && (
                  <Check className="size-3.5 text-accent" aria-hidden />
                )}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </MetaRow>

      <MetaRow label="פרויקט" htmlFor="detail-project">
        <select
          id="detail-project"
          value={task.projectId ?? ''}
          onChange={(e) =>
            run(() => updateTaskAction({ id: task.id, projectId: e.target.value || null }))
          }
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="">בלי פרויקט</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </MetaRow>

      <MetaRow label="תוויות">
        <Menu>
          <MenuTrigger asChild>
            <Button variant="secondary" size="sm" className="w-full justify-between gap-2">
              {task.labels.length ? (
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  {task.labels.slice(0, 2).map((label) => (
                    <span
                      key={label.id}
                      className="truncate rounded px-1.5 py-0.5 text-xs font-medium"
                      style={{
                        color: swatchVar(label.color),
                        backgroundColor: `color-mix(in oklab, ${swatchVar(label.color)} 14%, transparent)`,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                  {task.labels.length > 2 && (
                    <span className="num text-xs text-muted">+{task.labels.length - 2}</span>
                  )}
                </span>
              ) : (
                <span className="text-muted">בלי תוויות</span>
              )}
            </Button>
          </MenuTrigger>
          <MenuContent className="max-h-72 w-52 overflow-y-auto">
            {labels.length === 0 && <MenuLabel>עוד אין תוויות.</MenuLabel>}
            {labels.map((label) => {
              const on = task.labels.some((l) => l.id === label.id);
              return (
                <MenuItem
                  key={label.id}
                  /* The menu stays open: choosing labels is usually choosing
                     several, and a picker that closes after each one turns
                     three labels into three round trips. */
                  onSelect={(event) => {
                    event.preventDefault();
                    toggleLabel(label.id);
                  }}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: swatchVar(label.color) }}
                  />
                  <span className="flex-1 truncate">{label.name}</span>
                  {on && <Check className="size-3.5 text-accent" aria-hidden />}
                </MenuItem>
              );
            })}
          </MenuContent>
        </Menu>
      </MetaRow>
    </>
  );

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-pop-in" />
        <DialogPrimitive.Content
          className={cn(
            // Centred with inset-0 + m-auto rather than a translate, so it
            // behaves identically in both directions.
            'fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-3rem)] flex-col',
            'w-[min(58rem,calc(100vw-2rem))] overflow-hidden rounded-2xl',
            'border border-line bg-surface shadow-pop',
            'data-[state=open]:animate-pop-in',
            // A phone gets the whole screen. A centred dialog with a centimetre
            // of scrim around it is a worse full-screen view, not a smaller one.
            'max-md:h-dvh max-md:max-h-none max-md:w-full max-md:rounded-none max-md:border-0',
          )}
        >
          <DialogPrimitive.Title className="sr-only">{task.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            עריכת פרטי המשימה
          </DialogPrimitive.Description>

          <header className="flex shrink-0 items-center gap-2 border-be border-line px-4 py-2">
            {/* Where the task lives — which the modal is covering up. */}
            <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
              {project ? (
                <>
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: swatchVar(project.color) }}
                  />
                  <span className="truncate">{project.name}</span>
                </>
              ) : (
                <span className="truncate">תיבה נכנסת</span>
              )}
            </span>
            <span className="flex-1" />
            {onStep && (
              <>
                <IconButton
                  label="המשימה הקודמת"
                  disabled={!canStep?.prev}
                  onClick={() => onStep(-1)}
                  title="המשימה הקודמת (K)"
                >
                  <ChevronUp className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label="המשימה הבאה"
                  disabled={!canStep?.next}
                  onClick={() => onStep(1)}
                  title="המשימה הבאה (J)"
                >
                  <ChevronDown className="size-4" aria-hidden />
                </IconButton>
                <span aria-hidden className="mx-1 h-5 w-px bg-line" />
              </>
            )}
            <IconButton label="מחיקת המשימה" onClick={() => onDelete(task)}>
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
            <IconButton label="סגירה" onClick={onClose}>
              <X className="size-4" aria-hidden />
            </IconButton>
          </header>

          <div className="scroll-quiet flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_17rem] md:grid-rows-[1fr_auto]">
            {/* The description takes the slack.
                The rail is intrinsically taller than a short task's content, so
                something has to absorb the difference. Left as a gap it reads
                as a section that failed to load; given to the notes field it
                becomes what Todoist uses it for — a large, obvious place to
                click and start writing. */}
            <div className="order-1 flex min-w-0 flex-col p-6 md:col-start-1 md:row-start-1">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={task.status !== 'TODO'}
                  onClick={() => run(() => toggleTaskAction(task.id, task.status === 'TODO'))}
                  className={cn(
                    'mt-1.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
                    task.status !== 'TODO'
                      ? 'border-accent bg-accent'
                      : 'border-line-strong hover:border-accent',
                  )}
                >
                  <Check
                    className={cn(
                      'size-3 text-[var(--on-accent)]',
                      task.status !== 'TODO' ? 'opacity-100' : 'opacity-0',
                    )}
                    strokeWidth={3.5}
                    aria-hidden
                  />
                  <span className="sr-only">
                    {task.status !== 'TODO' ? 'ביטול השלמה' : 'סימון כהושלם'}
                  </span>
                </button>

                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  aria-label="שם המשימה"
                  className="border-transparent bg-transparent px-0 py-0 text-xl font-bold leading-snug"
                />
              </div>

              {/* One line at rest, growing to fit. A fixed three rows
                  reserved two empty lines on every task that has no notes —
                  which is most of them — and pushed the checklist down for
                  nothing. `field-sizing` does it in CSS where it is supported;
                  the rows fallback keeps it sane elsewhere. */}
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                rows={1}
                placeholder="הערות"
                aria-label="הערות"
                className="ms-8 mt-1 min-h-16 flex-1 resize-none border-transparent bg-transparent px-0 text-sm [field-sizing:content]"
              />
            </div>

            <aside data-task-properties
              className={cn(
                'order-2 shrink-0 border-line bg-surface-2/50 p-5',
                'border-bs md:order-none md:col-start-2 md:row-span-2 md:row-start-1',
                'md:border-bs-0 md:border-s',
              )}
            >
              {meta}
            </aside>

            <div className="order-3 min-w-0 border-bs border-line p-6 md:order-none md:col-start-1 md:row-start-2">
              <h3 className="mb-2 flex items-baseline gap-2 text-sm font-bold text-ink">
                רשימת משנה
                {task.subtasks.length > 0 && (
                  <span className="num text-xs font-normal text-muted">
                    {task.subtasks.filter((sub) => sub.status !== 'TODO').length}/
                    {task.subtasks.length}
                  </span>
                )}
              </h3>
              <ul className="space-y-1">
                {task.subtasks.map((sub) => (
                  <li key={sub.id} className="flex items-center gap-2.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={sub.status !== 'TODO'}
                      onClick={() => run(() => toggleTaskAction(sub.id, sub.status === 'TODO'))}
                      aria-label={
                        sub.status !== 'TODO'
                          ? `ביטול השלמה של הפריט ${sub.title}`
                          : `סימון הפריט ${sub.title} כהושלם`
                      }
                      className={cn(
                        'grid size-4 shrink-0 place-items-center rounded border-2 transition-colors',
                        sub.status !== 'TODO'
                          ? 'border-accent bg-accent'
                          : 'border-line-strong hover:border-accent',
                      )}
                    >
                      <Check
                        className={cn(
                          'size-2.5 text-[var(--on-accent)]',
                          sub.status !== 'TODO' ? 'opacity-100' : 'opacity-0',
                        )}
                        strokeWidth={4}
                        aria-hidden
                      />
                    </button>
                    <span
                      dir="auto"
                      className={cn(
                        'text-sm',
                        sub.status !== 'TODO' ? 'text-muted line-through' : 'text-ink',
                      )}
                    >
                      {sub.title}
                    </span>
                  </li>
                ))}
              </ul>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = newSubtask.trim();
                  if (!value) return;
                  setNewSubtask('');
                  run(() => addSubtaskAction(task.id, value));
                }}
                className="mt-1 flex items-center gap-2"
              >
                <Plus className="size-4 shrink-0 text-muted" aria-hidden />
                <input
                  dir="auto"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="פריט חדש"
                  aria-label="פריט חדש ברשימת המשנה"
                  className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted"
                />
              </form>
              <TaskComments key={task.id} taskId={task.id} />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const PRIORITY_TONE: Record<number, string> = {
  1: 'text-p1',
  2: 'text-p2',
  3: 'text-p3',
  4: 'text-line-strong',
};

/** One labelled control in the side rail. */
function MetaRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  /* 4px inside the pair, 16px between pairs — a 1:4 ratio, so the label
     visibly belongs to the control under it rather than floating between two.
     Both sit on the 4/8 scale the rest of the app uses.

     The label is a size smaller than the app's default field label. Seven of
     them stacked set the height of the whole dialog, and every 4px here is
     28px of emptiness at the bottom of the column beside it. */
  return (
    <div className="task-property" role="group" aria-label={label}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      <div className="task-property-value">{children}</div>
    </div>
  );
}
