'use client';

import { useEffect, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Check, Flag, Repeat } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PRIORITY_LABELS, swatchVar } from '@/lib/constants';
import {
  MIN_BLOCK_MINUTES,
  MINUTES_IN_DAY,
  PX_PER_MINUTE,
  formatRange,
  snapMinutes,
} from '@/lib/calendar-time';
import type { CalendarEntry, TaskDTO } from '@/server/tasks/queries';
import { useCalendarActions } from './calendar-context';

/**
 * Tasks on the calendar.
 *
 * Coloured by priority, as Todoist does: a soft wash of the priority hue, with
 * the completion circle ringed in the full colour. Deadlines are a different
 * species — an amber outline with a flag — because "due on this day" and
 * "planned for this day" must never be confused at a glance.
 *
 * Each piece keeps the circle and the title as separate controls: the circle
 * completes, the title opens and is the drag handle. One button for both would
 * make every attempt to tick a task open it instead.
 */

/** The completion control, shared by chips, blocks and the tray. */
export function CompleteCircle({
  task,
  done,
  size = 'sm',
}: {
  task: TaskDTO;
  done: boolean;
  size?: 'sm' | 'md';
}) {
  const { toggleTask } = useCalendarActions();
  const ring =
    task.priority === 1
      ? 'border-p1'
      : task.priority === 2
        ? 'border-p2'
        : task.priority === 3
          ? 'border-p3'
          : 'border-p4';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `ביטול השלמה: ${task.title}` : `סימון כהושלם: ${task.title}`}
      aria-description={`עדיפות: ${PRIORITY_LABELS[task.priority]}`}
      onClick={(event) => {
        event.stopPropagation();
        toggleTask(task);
      }}
      className={cn(
        'group/check relative grid shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-120',
        "before:absolute before:-inset-1.5 before:content-['']",
        size === 'sm' ? 'size-3.5' : 'size-4',
        done ? 'border-accent bg-accent' : cn(ring, 'bg-surface/70'),
      )}
    >
      <Check
        className={cn(
          'size-2.5 transition-opacity',
          done
            ? 'text-[var(--on-accent)] opacity-100'
            : 'text-muted opacity-0 group-hover/check:opacity-100',
        )}
        strokeWidth={3.5}
        aria-hidden
      />
    </button>
  );
}

/** One task as a single line: month cells and the week's all-day row. */
export function EntryChip({ entry, compact = false }: { entry: CalendarEntry; compact?: boolean }) {
  const { openTask, completing } = useCalendarActions();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.key,
    data: { entry },
  });

  const isDeadline = entry.kind === 'deadline';
  const done = entry.task.status !== 'TODO' || completing.has(entry.taskId);

  return (
    <div
      ref={setNodeRef}
      data-priority={entry.task.priority}
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-md ps-1.5 pe-1',
        compact ? 'h-[1.375rem] text-xs' : 'h-7 text-[0.8125rem]',
        isDeadline ? 'cal-chip-deadline' : 'cal-tone',
        done && 'opacity-55',
        isDragging && 'opacity-30',
      )}
    >
      {isDeadline ? (
        <Flag className="size-3 shrink-0" aria-label="מועד הגשה" />
      ) : (
        <CompleteCircle task={entry.task} done={done} />
      )}

      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => openTask(entry.taskId)}
        title={entry.task.title}
        className="flex min-w-0 flex-1 items-center gap-1 self-stretch rounded-sm text-start"
      >
        {entry.time && !isDeadline && (
          <span className="num shrink-0 text-[0.6875rem] font-semibold text-muted">{entry.time}</span>
        )}
        <span dir="auto" className={cn('truncate font-medium', done && 'line-through')}>
          {entry.task.title}
        </span>
        {entry.task.recurrence && !compact && (
          <Repeat className="size-3 shrink-0 text-muted" aria-label="חוזרת" />
        )}
      </button>
    </div>
  );
}

/**
 * A timed task on the week's hour grid: placed by its time, as tall as its
 * duration, and resizable from its bottom edge.
 */
export function TimeBlock({
  entry,
  start,
  end,
  lane,
  lanes,
}: {
  entry: CalendarEntry;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}) {
  const { openTask, completing, setDuration } = useCalendarActions();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.key,
    data: { entry },
  });

  /* The height follows the pointer while resizing, then holds the new value
     until the server's copy of the duration catches up. */
  const [liveDuration, setLiveDuration] = useState<number | null>(null);
  useEffect(() => setLiveDuration(null), [entry.task.durationMinutes]);

  const duration = Math.max(liveDuration ?? end - start, MIN_BLOCK_MINUTES);
  const height = duration * PX_PER_MINUTE;
  const done = entry.task.status !== 'TODO' || completing.has(entry.taskId);
  // Below ~40 minutes there is room for one line: title and time share it.
  const roomy = duration >= 40;

  function startResize(event: React.PointerEvent<HTMLSpanElement>) {
    // Keep dnd-kit from reading this as the start of a move.
    event.stopPropagation();
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const originY = event.clientY;
    const base = end - start;
    let next = base;

    const move = (e: PointerEvent) => {
      next = Math.min(
        Math.max(snapMinutes(base + (e.clientY - originY) / PX_PER_MINUTE), MIN_BLOCK_MINUTES),
        MINUTES_IN_DAY - start,
      );
      setLiveDuration(next);
    };
    const finish = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      if (next !== base) setDuration(entry.taskId, next);
      else setLiveDuration(null);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }

  return (
    <div
      ref={setNodeRef}
      data-priority={entry.task.priority}
      data-block={entry.key}
      style={{
        top: start * PX_PER_MINUTE + 1,
        height: height - 2,
        insetInlineStart: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 5px)`,
      }}
      className={cn(
        'cal-tone group/block @container absolute z-[1] flex overflow-hidden rounded-md',
        'hover:z-[2] focus-within:z-[2]',
        done && 'opacity-55',
        isDragging && 'opacity-30',
        liveDuration !== null && 'z-[3] shadow-pop',
      )}
    >
      <div className={cn('flex min-w-0 flex-1 gap-1.5 ps-1.5 pe-1', roomy ? 'pt-1.5' : 'items-center')}>
        <span className={cn('shrink-0', roomy && 'pt-px')}>
          <CompleteCircle task={entry.task} done={done} />
        </span>
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={() => openTask(entry.taskId)}
          title={`${entry.task.title} · ${formatRange(start, start + duration)}`}
          className={cn(
            'flex min-w-0 flex-1 self-stretch text-start',
            roomy ? 'flex-col items-start' : 'items-center gap-1.5',
          )}
        >
          <span
            dir="auto"
            className={cn(
              'min-w-0 text-xs font-semibold leading-4 text-ink',
              roomy ? 'line-clamp-2' : 'truncate',
              done && 'line-through',
            )}
          >
            {entry.task.title}
          </span>
          {/* On one line the title comes first; the time only joins it when the
              column is wide enough for both — its place on the axis says it. */}
          <span
            className={cn(
              'num shrink-0 items-center gap-1 whitespace-nowrap text-[0.6875rem] leading-4 text-muted',
              // A block squeezed beside another has no room for "16:00–17:30".
              roomy ? 'hidden @[5.5rem]:flex' : 'hidden @[10rem]:flex',
            )}
          >
            {formatRange(start, start + duration)}
            {entry.task.recurrence && <Repeat className="size-3" aria-label="חוזרת" />}
          </span>
          {duration >= 75 && entry.task.project && (
            <span className="mt-auto flex min-w-0 items-center gap-1 pb-1 text-[0.6875rem] text-muted">
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: swatchVar(entry.task.project.color) }}
              />
              <span dir="auto" className="truncate">
                {entry.task.project.name}
              </span>
            </span>
          )}
        </button>
      </div>

      <span
        aria-hidden
        onPointerDown={startResize}
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none after:absolute after:inset-x-[35%] after:bottom-0.5 after:h-[3px] after:rounded-full after:bg-current after:opacity-0 after:transition-opacity group-hover/block:after:opacity-30"
      />
    </div>
  );
}

/** What follows the cursor while dragging. */
export function ChipPreview({ entry }: { entry: CalendarEntry }) {
  const isDeadline = entry.kind === 'deadline';
  return (
    <div
      data-priority={entry.task.priority}
      className={cn(
        'pointer-events-none flex max-w-56 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium shadow-pop',
        isDeadline ? 'cal-chip-deadline' : 'cal-tone text-ink',
      )}
    >
      {isDeadline ? (
        <Flag className="size-3 shrink-0" aria-hidden />
      ) : (
        <span
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 rounded-full border-[1.5px]',
            entry.task.priority === 1
              ? 'border-p1'
              : entry.task.priority === 2
                ? 'border-p2'
                : entry.task.priority === 3
                  ? 'border-p3'
                  : 'border-p4',
          )}
        />
      )}
      <span dir="auto" className="truncate">
        {entry.task.title}
      </span>
    </div>
  );
}
