'use client';

import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CalendarDay } from '@/lib/calendar';
import type { CalendarEntry } from '@/server/tasks/queries';
import { EntryChip } from './entry-chip';
import { GoogleEventRow } from './google-events';
import type { GoogleEventDTO } from '@/lib/calendar-event-types';
import { useCalendarActions } from './calendar-context';

/** Beyond this a cell would grow; the rest collapse into a counter. */
const MAX_ITEMS = 4;

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

/**
 * The month, Todoist-quiet: hairline cells, the date in the corner, tasks as
 * soft priority-tinted lines. Clicking empty space in a day adds a task to it;
 * the date itself opens the day.
 */
export function MonthGrid({
  weeks,
  entriesByDay,
  googleEventsByDay = {},
  selectedDay,
  onSelectDay,
}: {
  weeks: { key: string; days: CalendarDay[] }[];
  entriesByDay: Record<string, CalendarEntry[]>;
  googleEventsByDay?: Record<string, GoogleEventDTO[]>;
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
}) {
  const todayWeekday = weeks.flatMap((w) => w.days).find((d) => d.isToday)?.date.getUTCDay();

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* dir="rtl" on the document already puts column 1 on the right, so the
          days are emitted Sunday-first in plain logical order. */}
      <div className="grid grid-cols-7 border-be border-line">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={cn(
              'py-2.5 text-center text-sm',
              index === todayWeekday ? 'font-bold text-ink' : 'text-muted',
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-e-0">
        {weeks.flatMap((week) =>
          week.days.map((day) => (
            <DayCell
              key={day.iso}
              day={day}
              entries={entriesByDay[day.iso] ?? []}
              googleEvents={googleEventsByDay[day.iso] ?? []}
              selected={selectedDay === day.iso}
              onSelectDay={onSelectDay}
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
  googleEvents,
  selected,
  onSelectDay,
}: {
  day: CalendarDay;
  entries: CalendarEntry[];
  googleEvents: GoogleEventDTO[];
  selected: boolean;
  onSelectDay: (iso: string) => void;
}) {
  const { quickAdd, draft } = useCalendarActions();
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.iso}`, data: { iso: day.iso } });

  const total = entries.length + googleEvents.length;
  // When something has to give, keep at least one event and fill with tasks.
  const room = total > MAX_ITEMS ? MAX_ITEMS - 1 : MAX_ITEMS;
  const visibleGoogle = googleEvents.slice(0, entries.length > 0 ? Math.min(1, room) : room);
  const visible = entries.slice(0, room - visibleGoogle.length);
  const hidden = total - visible.length - visibleGoogle.length;
  const drafting = draft?.iso === day.iso;

  const addHere = (event: React.MouseEvent) =>
    quickAdd({ iso: day.iso, time: null, x: event.clientX, y: event.clientY });

  return (
    <div
      ref={setNodeRef}
      data-day={day.iso}
      onClick={(event) => {
        // Only the empty ground of the day adds; chips and the date are their
        // own controls.
        if ((event.target as HTMLElement).closest('button, a')) return;
        addHere(event);
      }}
      className={cn(
        'group/day relative flex min-h-[7.75rem] cursor-pointer flex-col gap-0.5 border-be border-e border-line p-1.5 pt-1',
        'transition-colors duration-120',
        // Friday and Saturday are the Israeli weekend — a quieter ground.
        day.isWeekend && 'bg-surface-sunk/60',
        'hover:bg-surface-2/60',
        (selected || drafting) && 'bg-accent-soft/50 hover:bg-accent-soft/50',
        isOver && 'bg-accent-soft hover:bg-accent-soft',
      )}
    >
      <div className="mb-0.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelectDay(day.iso)}
          aria-label={`${day.weekdayLong} ${day.dayOfMonth}, ${total} פריטים`}
          className={cn(
            'num grid h-6 min-w-6 place-items-center rounded-md px-1 text-[0.8125rem] leading-none transition-colors',
            day.isToday
              ? 'bg-accent font-bold text-[var(--on-accent)] hover:bg-accent-hover'
              : day.inMonth
                ? 'font-semibold text-ink hover:bg-surface-2'
                : 'text-muted/70 hover:bg-surface-2',
          )}
        >
          {day.dayOfMonth}
        </button>
        <span className={cn('text-[0.6875rem] leading-none', day.inMonth ? 'text-muted' : 'text-muted/60')}>
          {day.hebrewDay}
        </span>
        {/* The Hebrew month is named once, on Rosh Chodesh, rather than
            repeated in all thirty cells. */}
        {day.hebrewMonthLabel && (
          <span className="truncate text-[0.6875rem] font-semibold leading-none text-accent">
            {day.hebrewMonthLabel}
          </span>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            addHere(event);
          }}
          aria-label={`הוספת משימה ל${day.weekdayLong} ${day.dayOfMonth}`}
          className="ms-auto grid size-6 place-items-center rounded-md text-muted opacity-0 transition-opacity hover:bg-surface hover:text-accent focus-visible:opacity-100 group-hover/day:opacity-100"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      {visibleGoogle.map((event) => (
        <GoogleEventRow key={event.id} event={event} compact />
      ))}
      {visible.map((entry) => (
        <EntryChip key={entry.key} entry={entry} compact />
      ))}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => onSelectDay(day.iso)}
          className="self-start rounded-sm px-1.5 py-0.5 text-start text-xs font-semibold text-muted hover:text-ink"
        >
          עוד <span className="num">{hidden}</span>
        </button>
      )}
    </div>
  );
}
