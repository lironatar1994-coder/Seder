'use client';

import { useDraggable } from '@dnd-kit/core';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { swatchVar } from '@/lib/constants';
import type { CalendarEntry } from '@/server/tasks/queries';

/**
 * One task on one day.
 *
 * Two visual species, because they mean different things:
 *   scheduled — a dot in the project's colour: work planned for this day.
 *   deadline  — an amber outline with a flag: this day is when it is due.
 * Amber is used for nothing else in the app, so the distinction reads without
 * a legend.
 */
export function EntryChip({
  entry,
  compact = false,
  onOpen,
}: {
  entry: CalendarEntry;
  /** Month cells are tight; week columns can breathe. */
  compact?: boolean;
  onOpen: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.key,
    data: { entry },
  });

  const done = entry.task.status !== 'TODO';
  const isDeadline = entry.kind === 'deadline';

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(entry.taskId)}
      title={entry.task.title}
      className={cn(
        'group/chip flex w-full items-center rounded-md text-start',
        'transition-colors duration-120',
        // Month cells are ~150px wide; every pixel of padding is a character
        // of the title lost, so compact trims hard.
        compact ? 'gap-1 px-1 py-[3px] text-xs' : 'gap-1.5 px-2 py-1 text-sm',
        isDeadline
          ? 'border border-flag/35 bg-flag-soft text-flag hover:border-flag/60'
          : 'bg-surface-2 text-ink-2 hover:bg-surface hover:text-ink',
        done && 'opacity-55',
        // The original stays in place at low opacity while the overlay follows
        // the cursor, so the row does not collapse mid-drag.
        isDragging && 'opacity-30',
      )}
    >
      {isDeadline ? (
        <Flag className="size-3 shrink-0" aria-hidden />
      ) : (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: swatchVar(entry.task.project?.color ?? 'slate') }}
        />
      )}

      {entry.time && !isDeadline && (
        <span className="num shrink-0 text-[0.7em] font-semibold opacity-80">{entry.time}</span>
      )}

      <span dir="auto" className={cn('min-w-0 flex-1 truncate', done && 'line-through')}>
        {entry.task.title}
      </span>

      {/* Priority is a secondary signal here — in a month cell it costs more
          title than it is worth, so it shows only in the roomier week column. */}
      {entry.task.priority <= 2 && !isDeadline && !compact && (
        <span
          aria-hidden
          className={cn(
            'h-3 w-[3px] shrink-0 rounded-full',
            entry.task.priority === 1 ? 'bg-p1' : 'bg-p2',
          )}
        />
      )}
    </button>
  );
}

/** What follows the cursor while dragging. */
export function ChipPreview({ entry }: { entry: CalendarEntry }) {
  const isDeadline = entry.kind === 'deadline';
  return (
    <div
      className={cn(
        'pointer-events-none flex max-w-56 items-center gap-1.5 rounded-md px-2 py-1 text-xs shadow-pop',
        isDeadline
          ? 'border border-flag/50 bg-flag-soft text-flag'
          : 'border border-line bg-surface text-ink',
      )}
    >
      {isDeadline ? (
        <Flag className="size-3 shrink-0" aria-hidden />
      ) : (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: swatchVar(entry.task.project?.color ?? 'slate') }}
        />
      )}
      <span dir="auto" className="truncate">
        {entry.task.title}
      </span>
    </div>
  );
}
