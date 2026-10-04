'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  parseISODay,
  shiftWeek,
  type MonthGrid as MonthGridData,
  type WeekGrid as WeekGridData,
} from '@/lib/calendar';
import type { CalendarData, CalendarEntry, TaskDTO } from '@/server/tasks/queries';
import { scheduleTaskAction, setDeadlineAction } from '@/server/tasks/actions';
import { useToast } from '@/components/ui/toast';
import { TaskDetail } from '@/components/task/task-detail';
import { deleteTaskAction } from '@/server/tasks/actions';
import { MonthGrid } from './month-grid';
import { WeekGrid } from './week-grid';
import { DayPanel } from './day-panel';
import { Agenda } from './agenda';
import { ChipPreview } from './entry-chip';

type Mode = 'month' | 'week';

interface Props {
  mode: Mode;
  grid: MonthGridData | WeekGridData;
  calendar: CalendarData;
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  selectedDay: string | null;
}

function isMonth(grid: MonthGridData | WeekGridData): grid is MonthGridData {
  return 'weeks' in grid;
}

export function CalendarView({ mode, grid, calendar, projects, labels, selectedDay }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  /* Two different ideas of "the selected day", deliberately not one.
     `panelDay` opens the desktop drawer, and is set only by the grids — which
     are `display:none` on a phone, so it can never be raised there. The agenda
     keeps its own focus. Seeding this from `?d=` instead would pop the drawer
     over the agenda every time the strip navigated across a month boundary,
     because the panel is portaled to the body and no wrapper can hide it. */
  const [panelDay, setPanelDay] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<CalendarEntry | null>(null);
  /** entry key → the day it was just dropped on, until the server catches up. */
  const [moved, setMoved] = useState<Record<string, string>>({});

  // A fresh `calendar` object means revalidation landed; the local guesses have
  // served their purpose.
  useEffect(() => setMoved({}), [calendar]);

  const entriesByDay = useMemo(() => {
    if (Object.keys(moved).length === 0) return calendar.entriesByDay;

    const next: Record<string, CalendarEntry[]> = {};
    for (const list of Object.values(calendar.entriesByDay)) {
      for (const entry of list) {
        const iso = moved[entry.key] ?? entry.iso;
        (next[iso] ??= []).push(iso === entry.iso ? entry : { ...entry, iso });
      }
    }
    return next;
  }, [calendar, moved]);

  const allEntries = useMemo(() => Object.values(entriesByDay).flat(), [entriesByDay]);
  const openTask: TaskDTO | null =
    allEntries.find((e) => e.taskId === openTaskId)?.task ?? null;

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

  /* ------------------------------------------------------------------ drag */

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const entry = event.active.data.current?.entry as CalendarEntry | undefined;
    const target = event.over?.data.current?.iso as string | undefined;
    if (!entry || !target || target === entry.iso) return;

    setMoved((prev) => ({ ...prev, [entry.key]: target }));

    startTransition(async () => {
      // Dragging a deadline marker moves the deadline; dragging a scheduled
      // chip moves the schedule. The two dates stay independent.
      const result =
        entry.kind === 'deadline'
          ? await setDeadlineAction(entry.taskId, target)
          : await scheduleTaskAction(entry.taskId, {
              bucket: 'SCHEDULED',
              date: target,
              time: entry.time,
            });

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
        case 'Escape':
          setPanelDay(null);
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, grid, mode, periodHref]);

  /* ----------------------------------------------------------------- render */

  const title = isMonth(grid) ? grid.gregorianMonth : grid.label;
  const subtitle = isMonth(grid) ? String(grid.gregorianYear) : null;

  return (
    // A month grid is not prose — it wants the full width, not the 44rem
    // reading column the list views use.
    <div data-wide className="pb-16">
      {/* Tighter on a phone: the strip below is the working control, and every
          pixel this header spends is one the first day of the agenda does not
          get. The month name stays — it is what tells you which weeks the
          strip is showing. */}
      <header className="pb-3 pt-5 md:pb-5 md:pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display flex items-baseline gap-2.5 text-2xl font-bold leading-none text-ink md:text-4xl">
              {title}
              {subtitle && (
                <span className="num text-lg font-normal text-muted md:text-2xl">{subtitle}</span>
              )}
            </h1>
            {/* The Hebrew months the period spans — a Gregorian month almost
                always straddles two. */}
            {grid.hebrewRange && (
              <p className="display mt-1 text-sm text-ink-2 md:mt-2 md:text-lg">
                {grid.hebrewRange}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="max-md:hidden">
              <ModeToggle mode={mode} />
            </span>

            <div className="flex items-center overflow-hidden rounded-lg border border-line-strong">
              {/* "Previous" points toward the start of the line — right, in
                  Hebrew — so the chevrons are chosen by direction, not mirrored. */}
              <NavArrow href={periodHref(grid.prevAnchor)} label="לתקופה הקודמת" direction="prev" />
              <Link
                href={mode === 'week' ? '/app/calendar?v=week' : '/app/calendar'}
                className="inline-flex items-center border-s border-e border-line-strong px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink [@media(pointer:coarse)]:min-h-11"
              >
                היום
              </Link>
              <NavArrow href={periodHref(grid.nextAnchor)} label="לתקופה הבאה" direction="next" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-md:hidden">
      <DndContext
        // Without an explicit id, dnd-kit numbers its accessibility
        // description element from a module counter that starts at a different
        // value on the client than on the server, and hydration fails on the
        // resulting aria-describedby.
        id="seder-calendar"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(event: DragStartEvent) =>
          setDragging((event.active.data.current?.entry as CalendarEntry) ?? null)
        }
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        {isMonth(grid) ? (
          <MonthGrid
            weeks={grid.weeks}
            entriesByDay={entriesByDay}
            selectedDay={panelDay}
            onSelectDay={setPanelDay}
            onOpenTask={setOpenTaskId}
          />
        ) : (
          <WeekGrid
            days={grid.days}
            entriesByDay={entriesByDay}
            selectedDay={panelDay}
            onSelectDay={setPanelDay}
            onOpenTask={setOpenTaskId}
          />
        )}

        <DragOverlay dropAnimation={null}>
          {dragging ? <ChipPreview entry={dragging} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Drag and keyboard are both pointer affordances; on a phone this
          paragraph would describe gestures that do not exist. */}
      <p className="mt-4 text-xs text-muted">
        גוררים משימה ליום אחר כדי לתזמן מחדש. <Kbd>←</Kbd> <Kbd>→</Kbd> לתקופה, <Kbd>T</Kbd> להיום,{' '}
        <Kbd>M</Kbd> חודש, <Kbd>W</Kbd> שבוע.
      </p>
      </div>

      <Agenda
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
          iso={panelDay}
          entries={entriesByDay[panelDay] ?? []}
          projects={projects}
          labels={labels}
          onClose={() => setPanelDay(null)}
          onOpenTask={(taskId) => {
            setPanelDay(null);
            setOpenTaskId(taskId);
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
      className="inline-flex items-center px-2.5 py-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-4"
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
    <div className="flex items-center overflow-hidden rounded-lg border border-line-strong">
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
            'inline-flex items-center px-3 py-2 text-sm font-semibold transition-colors',
            '[@media(pointer:coarse)]:min-h-11',
            mode === option.id
              ? 'bg-accent-soft text-accent'
              : 'text-muted hover:bg-surface-2 hover:text-ink',
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
