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
import type { MonthGrid as MonthGridData, WeekGrid as WeekGridData } from '@/lib/calendar';
import type { CalendarData, CalendarEntry, TaskDTO } from '@/server/tasks/queries';
import { scheduleTaskAction, setDeadlineAction } from '@/server/tasks/actions';
import { useToast } from '@/components/ui/toast';
import { TaskDetail } from '@/components/task/task-detail';
import { deleteTaskAction } from '@/server/tasks/actions';
import { MonthGrid } from './month-grid';
import { WeekGrid } from './week-grid';
import { DayPanel } from './day-panel';
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

  const [day, setDay] = useState<string | null>(selectedDay);
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
          setDay(null);
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
      <header className="pb-5 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display flex items-baseline gap-2.5 text-4xl font-bold leading-none text-ink">
              {title}
              {subtitle && <span className="num text-2xl font-normal text-muted">{subtitle}</span>}
            </h1>
            {/* The Hebrew months the period spans — a Gregorian month almost
                always straddles two. */}
            {grid.hebrewRange && (
              <p className="display mt-2 text-lg text-ink-2">{grid.hebrewRange}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ModeToggle mode={mode} />

            <div className="flex items-center overflow-hidden rounded-lg border border-line-strong">
              {/* "Previous" points toward the start of the line — right, in
                  Hebrew — so the chevrons are chosen by direction, not mirrored. */}
              <NavArrow href={periodHref(grid.prevAnchor)} label="לתקופה הקודמת" direction="prev" />
              <Link
                href={mode === 'week' ? '/app/calendar?v=week' : '/app/calendar'}
                className="border-s border-e border-line-strong px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                היום
              </Link>
              <NavArrow href={periodHref(grid.nextAnchor)} label="לתקופה הבאה" direction="next" />
            </div>
          </div>
        </div>
      </header>

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
            selectedDay={day}
            onSelectDay={setDay}
            onOpenTask={setOpenTaskId}
          />
        ) : (
          <WeekGrid
            days={grid.days}
            entriesByDay={entriesByDay}
            selectedDay={day}
            onSelectDay={setDay}
            onOpenTask={setOpenTaskId}
          />
        )}

        <DragOverlay dropAnimation={null}>
          {dragging ? <ChipPreview entry={dragging} /> : null}
        </DragOverlay>
      </DndContext>

      <p className="mt-4 text-xs text-muted">
        גוררים משימה ליום אחר כדי לתזמן מחדש. <Kbd>←</Kbd> <Kbd>→</Kbd> לתקופה, <Kbd>T</Kbd> להיום,{' '}
        <Kbd>M</Kbd> חודש, <Kbd>W</Kbd> שבוע.
      </p>

      {day && (
        <DayPanel
          iso={day}
          entries={entriesByDay[day] ?? []}
          projects={projects}
          labels={labels}
          onClose={() => setDay(null)}
          onOpenTask={(taskId) => {
            setDay(null);
            setOpenTaskId(taskId);
          }}
        />
      )}

      <TaskDetail
        task={openTask}
        openId={openTaskId}
        projects={projects}
        labels={labels}
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
      className="px-2.5 py-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
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
            'px-3 py-2 text-sm font-semibold transition-colors',
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
