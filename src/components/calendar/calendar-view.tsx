'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  parseISODay,
  shiftWeek,
  type MonthGrid as MonthGridData,
  type WeekGrid as WeekGridData,
} from '@/lib/calendar';
import {
  MIN_BLOCK_MINUTES,
  PX_PER_MINUTE,
  clampStart,
  fromMinutes,
  snapMinutes,
} from '@/lib/calendar-time';
import { today } from '@/lib/dates';
import type { CalendarData, CalendarEntry, TaskDTO } from '@/server/tasks/queries';
import {
  deleteTaskAction,
  scheduleTaskAction,
  setDeadlineAction,
  toggleTaskAction,
  undoRepeatAction,
  updateTaskAction,
} from '@/server/tasks/actions';
import { useToast } from '@/components/ui/toast';
import { TaskDetail } from '@/components/task/task-detail';
import { MonthGrid } from './month-grid';
import { TimeGrid } from './time-grid';
import { DayPanel } from './day-panel';
import { Agenda } from './agenda';
import { ChipPreview } from './entry-chip';
import { UndatedPanel } from './undated-panel';
import { QuickAddPopover } from './quick-add-popover';
import { MonthPicker } from './month-picker';
import { CalendarActionsProvider, type CalendarActions, type QuickAddDraft } from './calendar-context';
import type { GoogleEventDTO } from '@/lib/calendar-event-types';
import { GoogleSyncBar } from './google-events';
import { updateNavigation, useNavigationParam, useNavigationTask } from '@/components/nav/navigation-state';

type Mode = 'month' | 'week';

interface Props {
  mode: Mode;
  grid: MonthGridData | WeekGridData;
  calendar: CalendarData;
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  selectedDay: string | null;
  googleEventsByDay: Record<string, GoogleEventDTO[]>;
  googleConnected: boolean;
  googleError?: string | null;
  undated: TaskDTO[];
}

/** A drop the server has not confirmed yet. */
interface Move {
  iso: string;
  time: string | null;
  entry: CalendarEntry;
}

const UNDATED_KEY = 'seder.calendar.undated';

function isMonth(grid: MonthGridData | WeekGridData): grid is MonthGridData {
  return 'weeks' in grid;
}

export function CalendarView({
  mode,
  grid,
  calendar,
  projects,
  labels,
  selectedDay,
  googleEventsByDay,
  googleConnected,
  googleError,
  undated,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  /* Two different ideas of "the selected day", deliberately not one.
     `panelDay` opens the desktop drawer, and is set by the grids — which
     are `display:none` on a phone, so it can never be raised there. The agenda
     keeps its own focus. Seeding this from `?d=` instead would pop the drawer
     over the agenda every time the strip navigated across a month boundary,
     because the panel is portaled to the body and no wrapper can hide it. */
  const [panelDay, setPanelDay] = useNavigationParam('dayPanel');
  const [openTaskId, setOpenTaskId] = useNavigationParam('task');
  const [dragging, setDragging] = useState<CalendarEntry | null>(null);
  const [moved, setMoved] = useState<Record<string, Move>>({});
  const [completing, setCompleting] = useState<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = useState<QuickAddDraft | null>(null);
  const [undatedOpen, setUndatedOpen] = useState(false);

  /* Where the pointer is, and where in the block it grabbed — so a block
     dropped on the hour grid lands where its top edge is, not where the
     pointer happens to be inside it. */
  const pointer = useRef({ x: 0, y: 0 });
  const grabOffset = useRef(0);

  // A fresh `calendar` object means revalidation landed; the local guesses have
  // served their purpose.
  useEffect(() => {
    setMoved({});
    setCompleting(new Set());
  }, [calendar]);

  useEffect(() => {
    try {
      setUndatedOpen(localStorage.getItem(UNDATED_KEY) === '1');
    } catch {}
  }, []);

  const toggleUndated = useCallback((open: boolean) => {
    setUndatedOpen(open);
    try {
      localStorage.setItem(UNDATED_KEY, open ? '1' : '0');
    } catch {}
  }, []);

  const entriesByDay = useMemo(() => {
    if (Object.keys(moved).length === 0) return calendar.entriesByDay;

    const next: Record<string, CalendarEntry[]> = {};
    const seen = new Set<string>();
    for (const list of Object.values(calendar.entriesByDay)) {
      for (const entry of list) {
        seen.add(entry.key);
        const move = moved[entry.key];
        if (!move) {
          (next[entry.iso] ??= []).push(entry);
          continue;
        }
        (next[move.iso] ??= []).push({ ...entry, iso: move.iso, time: entry.kind === 'deadline' ? null : move.time });
      }
    }
    // Dropped from the tray: not on the calendar yet, so place it by hand,
    // under the key the server will give it.
    for (const [key, move] of Object.entries(moved)) {
      if (seen.has(key)) continue;
      (next[move.iso] ??= []).push({
        ...move.entry,
        key: `${move.entry.taskId}:scheduled`,
        iso: move.iso,
        time: move.time,
      });
    }
    return next;
  }, [calendar, moved]);

  const trayTasks = useMemo(
    () => undated.filter((task) => !moved[`${task.id}:undated`]),
    [undated, moved],
  );

  const allEntries = useMemo(() => Object.values(entriesByDay).flat(), [entriesByDay]);
  const openTask: TaskDTO | null = useNavigationTask(
    openTaskId,
    allEntries.find((e) => e.taskId === openTaskId)?.task ??
      undated.find((task) => task.id === openTaskId) ??
      null,
    calendar,
  );

  /* Day-ordered task ids for the editor's j/k stepping. Deduped: a task with
     both a schedule and a deadline yields two entries, and stepping over the
     pair would appear to stick on the same task. */
  const stepOrder = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const day of grid.days) {
      for (const entry of entriesByDay[day.iso] ?? []) {
        if (seen.has(entry.taskId)) continue;
        seen.add(entry.taskId);
        ids.push(entry.taskId);
      }
    }
    return ids;
  }, [grid, entriesByDay]);

  const stepIndex = openTaskId ? stepOrder.indexOf(openTaskId) : -1;

  const periodHref = useCallback(
    (anchor: string, nextMode: Mode = mode) =>
      nextMode === 'week' ? `/app/calendar?v=week&w=${anchor}` : `/app/calendar?m=${anchor}`,
    [mode],
  );

  /* --------------------------------------------------------------- actions */

  const toggleTask = useCallback(
    (task: TaskDTO) => {
      if (task.status !== 'TODO') {
        startTransition(async () => {
          const result = await toggleTaskAction(task.id, false);
          if (!result.ok) toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
        });
        return;
      }
      if (completing.has(task.id)) return;

      setCompleting((prev) => new Set(prev).add(task.id));
      const restore = () =>
        setCompleting((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });

      startTransition(async () => {
        const result = await toggleTaskAction(task.id, true);
        if (!result.ok) {
          restore();
          toast({ message: result.error ?? 'המשימה לא הושלמה', tone: 'error' });
          return;
        }
        const repeat = result.repeat;
        toast({
          message: repeat ? `הושלם — חוזר ב${repeat.nextLabel}` : `הושלם: ${task.title}`,
          tone: 'success',
          sound: 'complete',
          action: {
            label: 'ביטול',
            onClick: () =>
              startTransition(async () => {
                await (repeat
                  ? undoRepeatAction(task.id, repeat.snapshotId, repeat.previousDate)
                  : toggleTaskAction(task.id, false));
              }),
          },
        });
      });
    },
    [completing, toast],
  );

  const setDuration = useCallback(
    (taskId: string, minutes: number) =>
      startTransition(async () => {
        const result = await updateTaskAction({ id: taskId, durationMinutes: minutes });
        if (!result.ok) toast({ message: result.error ?? 'לא הצלחנו לשנות את משך המשימה', tone: 'error' });
      }),
    [toast],
  );

  const actions = useMemo<CalendarActions>(
    () => ({
      openTask: (taskId) => {
        setDraft(null);
        setOpenTaskId(taskId);
      },
      toggleTask,
      completing,
      setDuration,
      quickAdd: setDraft,
      draft,
    }),
    [toggleTask, completing, setDuration, draft, setOpenTaskId],
  );

  /* ------------------------------------------------------------------ drag */

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!dragging) return;
    const track = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('pointermove', track);
    return () => window.removeEventListener('pointermove', track);
  }, [dragging]);

  function handleDragStart(event: DragStartEvent) {
    const entry = (event.active.data.current?.entry as CalendarEntry) ?? null;
    setDragging(entry);
    setDraft(null);
    const start = event.activatorEvent as PointerEvent;
    pointer.current = { x: start.clientX, y: start.clientY };
    const block = entry ? document.querySelector(`[data-block="${CSS.escape(entry.key)}"]`) : null;
    grabOffset.current = block ? start.clientY - block.getBoundingClientRect().top : 0;
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const entry = event.active.data.current?.entry as CalendarEntry | undefined;
    const over = event.over?.data.current as { iso: string; zone?: 'time' | 'allday' } | undefined;
    if (!entry || !over) return;

    const isDeadline = entry.kind === 'deadline';
    let time: string | null = entry.time;
    if (over.zone === 'allday') time = null;
    if (over.zone === 'time' && !isDeadline) {
      const column = document.querySelector(`[data-timecol="${over.iso}"]`);
      if (!column) return;
      const top = pointer.current.y - grabOffset.current - column.getBoundingClientRect().top;
      const duration = entry.task.durationMinutes ?? MIN_BLOCK_MINUTES;
      time = fromMinutes(clampStart(snapMinutes(top / PX_PER_MINUTE), duration));
    }
    if (isDeadline) time = null;

    if (over.iso === entry.iso && time === entry.time) return;

    setMoved((prev) => ({ ...prev, [entry.key]: { iso: over.iso, time, entry } }));

    startTransition(async () => {
      // Dragging a deadline marker moves the deadline; dragging a scheduled
      // chip moves the schedule. The two dates stay independent.
      const result = isDeadline
        ? await setDeadlineAction(entry.taskId, over.iso)
        : await scheduleTaskAction(entry.taskId, { bucket: 'SCHEDULED', date: over.iso, time });

      if (!result.ok) {
        setMoved((prev) => {
          const next = { ...prev };
          delete next[entry.key];
          return next;
        });
        toast({ message: result.error ?? 'לא הצלחנו להזיז את המשימה', tone: 'error' });
      }
    });
  }

  /* -------------------------------------------------------------- keyboard */

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      // An open dialog or popover owns the keyboard.
      if (document.querySelector('[role="dialog"]')) return;

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          event.preventDefault();
          // Forward in time follows the reading direction: left in Hebrew.
          const rtl = document.documentElement.dir !== 'ltr';
          const forward = rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
          router.push(periodHref(forward ? grid.nextAnchor : grid.prevAnchor));
          break;
        }
        case 't':
        case 'T':
          event.preventDefault();
          router.push(mode === 'week' ? '/app/calendar?v=week' : '/app/calendar');
          break;
        case 'm':
        case 'M':
          event.preventDefault();
          router.push('/app/calendar');
          break;
        case 'w':
        case 'W':
          event.preventDefault();
          router.push('/app/calendar?v=week');
          break;
        case 'u':
        case 'U':
          event.preventDefault();
          toggleUndated(!undatedOpen);
          break;
        case 'Escape':
          setPanelDay(null);
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, grid, mode, periodHref, undatedOpen, toggleUndated, setPanelDay]);

  /* ----------------------------------------------------------------- render */

  // A week is named by the month most of it falls in — its Wednesday's.
  const titleDate = isMonth(grid) ? grid.first : grid.days[3].date;
  const now = today();

  return (
    // A month grid is not prose — it wants the full width, not the 44rem
    // reading column the list views use.
    <div data-wide className="pb-10">
      <CalendarActionsProvider value={actions}>
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-3 pt-5 md:pb-4 md:pt-7">
          <div className="min-w-0">
            <h1 className="display text-3xl font-bold leading-tight text-ink md:text-4xl">לוח שנה</h1>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <MonthPicker
                month={titleDate.getUTCMonth()}
                year={titleDate.getUTCFullYear()}
                currentMonth={now.getUTCMonth()}
                currentYear={now.getUTCFullYear()}
                hrefFor={(anchor) => (mode === 'week' ? `/app/calendar?v=week&w=${anchor}-01` : `/app/calendar?m=${anchor}`)}
              />
              {/* The Hebrew months the period spans — a Gregorian month almost
                  always straddles two. */}
              {grid.hebrewRange && <span className="display text-sm text-muted md:text-base">{grid.hebrewRange}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="max-md:hidden">
              <ModeToggle mode={mode} />
            </span>

            <div className="flex items-center gap-0.5">
              {/* "Previous" points toward the start of the line — right, in
                  Hebrew — so the chevrons are chosen by direction, not mirrored. */}
              <NavArrow href={periodHref(grid.prevAnchor)} label={mode === 'week' ? 'לשבוע הקודם' : 'לחודש הקודם'} direction="prev" />
              <Link
                href={mode === 'week' ? '/app/calendar?v=week' : '/app/calendar'}
                className="inline-flex h-8 items-center rounded-md border border-line-strong px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink [@media(pointer:coarse)]:h-11"
              >
                היום
              </Link>
              <NavArrow href={periodHref(grid.nextAnchor)} label={mode === 'week' ? 'לשבוע הבא' : 'לחודש הבא'} direction="next" />
            </div>

            <button
              type="button"
              onClick={() => toggleUndated(!undatedOpen)}
              aria-pressed={undatedOpen}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-semibold transition-colors max-md:hidden',
                undatedOpen
                  ? 'border-accent/40 bg-accent-soft text-accent'
                  : 'border-line-strong text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              ללא תאריך
              {trayTasks.length > 0 && <span className="num text-xs opacity-75">{trayTasks.length}</span>}
              <PanelLeft className="size-4" aria-hidden />
            </button>
          </div>
        </header>

        <GoogleSyncBar connected={googleConnected} lastError={googleError} />

        <div className="max-md:hidden">
          <DndContext
            // Without an explicit id, dnd-kit numbers its accessibility
            // description element from a module counter that starts at a different
            // value on the client than on the server, and hydration fails on the
            // resulting aria-describedby.
            id="seder-calendar"
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
          >
            <div
              className={cn(
                'grid items-start gap-4',
                undatedOpen ? 'grid-cols-[minmax(0,1fr)_16.5rem]' : 'grid-cols-1',
              )}
            >
              {isMonth(grid) ? (
                <MonthGrid
                  weeks={grid.weeks}
                  googleEventsByDay={googleEventsByDay}
                  entriesByDay={entriesByDay}
                  selectedDay={panelDay}
                  onSelectDay={setPanelDay}
                />
              ) : (
                <TimeGrid
                  days={grid.days}
                  googleEventsByDay={googleEventsByDay}
                  entriesByDay={entriesByDay}
                  selectedDay={panelDay}
                  onSelectDay={setPanelDay}
                />
              )}

              {undatedOpen && (
                <UndatedPanel
                  tasks={trayTasks}
                  projects={projects}
                  labels={labels}
                  onClose={() => toggleUndated(false)}
                />
              )}
            </div>

            <DragOverlay dropAnimation={null}>
              {dragging ? <ChipPreview entry={dragging} /> : null}
            </DragOverlay>
          </DndContext>

          {/* Drag and keyboard are both pointer affordances; on a phone this
              paragraph would describe gestures that do not exist. */}
          <p className="mt-3 text-xs text-muted">
            {mode === 'week' ? 'לחיצה על שעה פנויה מוסיפה משימה. ' : 'לחיצה על יום מוסיפה משימה. '}
            גוררים כדי לתזמן מחדש{mode === 'week' ? ', ומושכים את תחתית המשימה כדי לשנות משך' : ''}.{' '}
            <Kbd>←</Kbd> <Kbd>→</Kbd> לתקופה, <Kbd>T</Kbd> להיום, <Kbd>M</Kbd> חודש, <Kbd>W</Kbd> שבוע,{' '}
            <Kbd>U</Kbd> ללא תאריך.
          </p>
        </div>

        <QuickAddPopover draft={draft} projects={projects} labels={labels} onClose={() => setDraft(null)} />
      </CalendarActionsProvider>

      <Agenda
        googleEventsByDay={googleEventsByDay}
        days={grid.days}
        weeks={isMonth(grid) ? grid.weeks.map((week) => week.days) : [grid.days]}
        entriesByDay={entriesByDay}
        projects={projects}
        labels={labels}
        initialDay={selectedDay}
        boundaryHref={(direction, sundayIso) => {
          /* Out of loaded weeks: fetch the neighbouring period and land on the
             adjacent Sunday, which `?d=` carries so the strip opens there
             rather than snapping back to today. */
          const target = shiftWeek(parseISODay(sundayIso), direction);
          const anchor = direction === -1 ? grid.prevAnchor : grid.nextAnchor;
          const base =
            mode === 'week' ? `/app/calendar?v=week&w=${anchor}` : `/app/calendar?m=${anchor}`;
          return `${base}&d=${target}`;
        }}
        onOpenTask={setOpenTaskId}
      />

      {panelDay && (
        <DayPanel
          googleEvents={googleEventsByDay[panelDay] ?? []}
          iso={panelDay}
          entries={entriesByDay[panelDay] ?? []}
          projects={projects}
          labels={labels}
          onClose={() => setPanelDay(null)}
          onOpenTask={(taskId) => {
            updateNavigation({ dayPanel: null, task: taskId });
          }}
        />
      )}

      <TaskDetail
        task={openTask}
        openId={openTaskId}
        projects={projects}
        labels={labels}
        onStep={(direction) => {
          const next = stepOrder[stepIndex + direction];
          if (next) setOpenTaskId(next);
        }}
        canStep={{
          prev: stepIndex > 0,
          next: stepIndex >= 0 && stepIndex < stepOrder.length - 1,
        }}
        onClose={() => setOpenTaskId(null)}
        onDelete={(task) => {
          setOpenTaskId(null);
          startTransition(async () => {
            const result = await deleteTaskAction(task.id);
            if (result.ok) toast({ message: `נמחק: ${task.title}` });
            else toast({ message: result.error ?? 'המחיקה נכשלה', tone: 'error' });
          });
        }}
      />
    </div>
  );
}

function NavArrow({
  href,
  label,
  direction,
}: {
  href: string;
  label: string;
  direction: 'prev' | 'next';
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink [@media(pointer:coarse)]:size-11"
    >
      {/* The timeline runs along the reading direction, so in Hebrew "earlier"
          points right and "later" points left. These are already the RTL
          glyphs — `icon-flip` would undo that, not help. */}
      {direction === 'prev' ? (
        <ChevronRight className="size-4" aria-hidden />
      ) : (
        <ChevronLeft className="size-4" aria-hidden />
      )}
    </Link>
  );
}

function ModeToggle({ mode }: { mode: Mode }) {
  return (
    <div className="flex items-center rounded-lg bg-surface-2 p-0.5">
      {(
        [
          { id: 'month', label: 'חודש', href: '/app/calendar' },
          { id: 'week', label: 'שבוע', href: '/app/calendar?v=week' },
        ] as const
      ).map((option) => (
        <Link
          key={option.id}
          href={option.href}
          aria-current={mode === option.id ? 'true' : undefined}
          className={cn(
            'inline-flex h-7 items-center rounded-md px-3 text-sm font-semibold transition-colors',
            '[@media(pointer:coarse)]:min-h-11',
            mode === option.id
              ? 'bg-surface text-ink shadow-row'
              : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="num rounded border border-line px-1 text-[0.7rem] text-muted">{children}</kbd>
  );
}
