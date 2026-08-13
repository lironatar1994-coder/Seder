'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import { swatchVar } from '@/lib/constants';
import type { CalendarDay } from '@/lib/calendar';
import { WEEKDAY_HEADERS } from '@/lib/calendar';
import type { CalendarEntry } from '@/server/tasks/queries';
import { EntryChip } from './entry-chip';

/** Beyond this a cell would overflow; the rest collapse into a counter. */
const MAX_CHIPS = 3;

export function MonthGrid({
  weeks,
  entriesByDay,
  selectedDay,
  onSelectDay,
  onOpenTask,
}: {
  weeks: { key: string; days: CalendarDay[] }[];
  entriesByDay: Record<string, CalendarEntry[]>;
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* dir="rtl" on the document already puts column 1 on the right, so the
          days are emitted Sunday-first in plain logical order. */}
      <div className="grid grid-cols-7 border-be border-line bg-surface-2">
        {WEEKDAY_HEADERS.map((label, index) => (
          <div
            key={label}
            className={cn(
              'px-2 py-2 text-center text-xs font-bold',
              index >= 5 ? 'text-muted' : 'text-ink-2',
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flatMap((week) =>
          week.days.map((day) => (
            <DayCell
              key={day.iso}
              day={day}
              entries={entriesByDay[day.iso] ?? []}
              selected={selectedDay === day.iso}
              onSelectDay={onSelectDay}
              onOpenTask={onOpenTask}
            />
          )),
        )}
      </div>
    </div>
  );
}

function DayCell({
  day,
  entries,
  selected,
  onSelectDay,
  onOpenTask,
}: {
  day: CalendarDay;
  entries: CalendarEntry[];
  selected: boolean;
  onSelectDay: (iso: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.iso}`, data: { iso: day.iso } });

  const visible = entries.slice(0, MAX_CHIPS);
  const hidden = entries.length - visible.length;

  const dayLabel = `${day.weekdayLong} ${day.dayOfMonth}, ${entries.length} פריטים`;

  /* Shared by both, so the two layouts cannot drift into showing different
     dates. The Hebrew month is named once, on Rosh Chodesh, rather than
     repeated in all thirty cells. */
  const dateLine = (
    <>
      <span className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'num text-sm leading-none',
            day.isToday
              ? 'grid size-6 place-items-center rounded-full bg-accent font-bold text-[var(--on-accent)]'
              : day.inMonth
                ? 'font-semibold text-ink'
                : 'text-muted',
          )}
        >
          {day.dayOfMonth}
        </span>
        <span className="text-[0.7rem] leading-none text-muted">{day.hebrewDay}</span>
      </span>

      {day.hebrewMonthLabel && (
        <span className="truncate text-[0.7rem] font-semibold leading-none text-accent">
          {day.hebrewMonthLabel}
        </span>
      )}
    </>
  );

  return (
    <div
      ref={setNodeRef}
      data-day={day.iso}
      className={cn(
        // No horizontal padding on the phone: at seven columns every pixel of
        // it comes off the tap target, and the cell border already separates
        // one day from the next.
        'relative flex min-h-16 flex-col gap-1 border-be border-s border-line px-px py-1 md:min-h-28 md:p-1.5',
        // Friday and Saturday are the Israeli weekend — a quieter ground, not a
        // different colour.
        day.isWeekend ? 'bg-surface-sunk' : 'bg-surface',
        !day.inMonth && 'opacity-45',
        selected && 'ring-2 ring-inset ring-accent',
        isOver && 'bg-accent-soft',
      )}
    >
      {/* Phone: the whole cell is one control.
          A seven-column grid gives each day about 50px, which is not enough for
          a title — a truncated "ל…" is noise, not information — so the day
          shows dots and opens the day sheet for the rest. That was two buttons
          tiling the cell, one of them `aria-hidden` purely to be a bigger
          target, and neither of them tall enough to hit reliably. One button
          the size of the cell says the same thing and is 44px. */}
      <button
        type="button"
        onClick={() => onSelectDay(day.iso)}
        aria-label={dayLabel}
        className="flex flex-1 flex-col gap-1 rounded-sm text-start md:hidden"
      >
        {dateLine}
        <span className="flex flex-1 items-start justify-center gap-1 pt-0.5">
          {entries.slice(0, 3).map((entry) => (
            <span
              key={entry.key}
              className={cn('size-1.5 rounded-full', entry.task.status !== 'TODO' && 'opacity-40')}
              style={{
                backgroundColor:
                  entry.kind === 'deadline'
                    ? 'var(--flag)'
                    : swatchVar(entry.task.project?.color ?? 'slate'),
              }}
            />
          ))}
          {entries.length > 3 && <span className="text-[0.6rem] leading-none text-muted">+</span>}
        </span>
      </button>

      {/* Desktop: the date opens the day, and each entry below is its own
          control, so the cell cannot be one button. */}
      <button
        type="button"
        onClick={() => onSelectDay(day.iso)}
        aria-label={dayLabel}
        className="hidden items-baseline justify-between gap-1 rounded-sm text-start md:flex"
      >
        {dateLine}
      </button>

      <div className="hidden min-h-0 flex-1 flex-col gap-0.5 md:flex">
        {visible.map((entry) => (
          <EntryChip key={entry.key} entry={entry} compact onOpen={onOpenTask} />
        ))}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => onSelectDay(day.iso)}
            className="rounded-sm px-1.5 py-0.5 text-start text-[0.7rem] font-semibold text-muted hover:text-ink"
          >
            <span className="num">+{hidden}</span> נוספות
          </button>
        )}
      </div>
    </div>
  );
}
