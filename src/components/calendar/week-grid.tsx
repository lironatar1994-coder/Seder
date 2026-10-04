'use client';

import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CalendarDay } from '@/lib/calendar';
import type { CalendarEntry } from '@/server/tasks/queries';
import { EntryChip } from './entry-chip';
import { GoogleEventRow } from './google-events';
import type { GoogleEventDTO } from '@/lib/calendar-event-types';

/**
 * The week, as seven readable columns rather than a pixel-positioned hour grid.
 *
 * A task list is not a meeting calendar: most tasks carry a day and not a time,
 * so an hour grid would be mostly empty space with the real content squeezed
 * into an "all day" strip. Timed items keep their clock order and wear their
 * time; untimed ones sit below. Same information, none of the empty rows.
 */
export function WeekGrid({
  days,
  entriesByDay,
  googleEventsByDay = {},
  selectedDay,
  onSelectDay,
  onOpenTask,
}: {
  days: CalendarDay[];
  entriesByDay: Record<string, CalendarEntry[]>;
  googleEventsByDay?: Record<string, GoogleEventDTO[]>;
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    // Seven readable columns need roughly 700px. On a phone the week scrolls
    // sideways rather than squeezing each day into 50px.
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <div className="grid min-w-[44rem] grid-cols-7">
        {days.map((day) => (
          <WeekColumn
            key={day.iso}
            day={day}
            entries={entriesByDay[day.iso] ?? []}
            googleEvents={googleEventsByDay[day.iso] ?? []}
            selected={selectedDay === day.iso}
            onSelectDay={onSelectDay}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </div>
  );
}

function WeekColumn({
  day,
  entries,
  googleEvents,
  selected,
  onSelectDay,
  onOpenTask,
}: {
  day: CalendarDay;
  entries: CalendarEntry[];
  googleEvents: GoogleEventDTO[];
  selected: boolean;
  onSelectDay: (iso: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.iso}`, data: { iso: day.iso } });

  const timed = entries.filter((e) => e.kind === 'scheduled' && e.time);
  const untimed = entries.filter((e) => e.kind === 'scheduled' && !e.time);
  const deadlines = entries.filter((e) => e.kind === 'deadline');

  return (
    <div
      ref={setNodeRef}
      data-day={day.iso}
      className={cn(
        'group flex min-h-[22rem] flex-col border-s border-line',
        day.isWeekend ? 'bg-surface-sunk' : 'bg-surface',
        selected && 'ring-2 ring-inset ring-accent',
        isOver && 'bg-accent-soft',
      )}
    >
      <button
        type="button"
        onClick={() => onSelectDay(day.iso)}
        className={cn(
          'flex flex-col items-center gap-0.5 border-be border-line px-2 py-2.5 transition-colors hover:bg-surface-2',
          day.isToday && 'bg-accent-soft hover:bg-accent-soft',
        )}
      >
        <span className={cn('text-xs font-semibold', day.isToday ? 'text-accent' : 'text-muted')}>
          {day.weekdayLong.replace('יום ', '')}
        </span>
        <span
          className={cn(
            'num text-lg leading-none',
            day.isToday
              ? 'grid size-7 place-items-center rounded-full bg-accent font-bold text-[var(--on-accent)]'
              : 'font-semibold text-ink',
          )}
        >
          {day.dayOfMonth}
        </span>
        <span className="text-[0.7rem] leading-none text-muted">
          {day.hebrewMonthLabel ? `${day.hebrewDay} ${day.hebrewMonthLabel}` : day.hebrewDay}
        </span>
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-1 p-1.5">
        {googleEvents.map(event => <GoogleEventRow key={event.id} event={event} compact />)}
        {timed.map((entry) => (
          <EntryChip key={entry.key} entry={entry} onOpen={onOpenTask} />
        ))}

        {timed.length > 0 && untimed.length > 0 && <div className="my-0.5 h-px bg-line" />}

        {untimed.map((entry) => (
          <EntryChip key={entry.key} entry={entry} onOpen={onOpenTask} />
        ))}

        {deadlines.length > 0 && (
          <>
            <div className="mt-1 px-1 text-[0.7rem] font-semibold text-muted">מועדי הגשה</div>
            {deadlines.map((entry) => (
              <EntryChip key={entry.key} entry={entry} onOpen={onOpenTask} />
            ))}
          </>
        )}

        <button
          type="button"
          onClick={() => onSelectDay(day.iso)}
          aria-label={`הוספת משימה ל${day.weekdayLong}`}
          className="mt-auto flex items-center justify-center gap-1 rounded-md py-1.5 text-xs text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
