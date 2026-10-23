'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CalendarDay } from '@/lib/calendar';
import {
  HOUR_PX,
  MINUTES_IN_DAY,
  PX_PER_MINUTE,
  formatRange,
  fromMinutes,
  jerusalemMinutes,
  layoutSpans,
  toMinutes,
} from '@/lib/calendar-time';
import type { CalendarEntry } from '@/server/tasks/queries';
import type { GoogleEventDTO } from '@/lib/calendar-event-types';
import { EntryChip, TimeBlock } from './entry-chip';
import { GoogleEventRow } from './google-events';
import { useCalendarActions } from './calendar-context';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
/** The all-day row shows this many lines per day before it folds. */
const ALL_DAY_LINES = 2;
const GRID_COLUMNS = 'grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))]';
const DEFAULT_TASK_MINUTES = 30;

/**
 * The week as Todoist draws it: an "all day" strip for undated-time work and
 * deadlines, then an hour grid where timed tasks sit at their time, as tall as
 * their duration. Drag a task to a slot to give it that hour; drag it to the
 * strip to take the hour away; pull a block's bottom edge to change how long
 * it takes. A click on empty grid adds a task at that time.
 */
export function TimeGrid({
  days,
  entriesByDay,
  googleEventsByDay = {},
  selectedDay,
  onSelectDay,
}: {
  days: CalendarDay[];
  entriesByDay: Record<string, CalendarEntry[]>;
  googleEventsByDay?: Record<string, GoogleEventDTO[]>;
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const now = useNowMinutes();

  const allDayCounts = days.map(
    (day) =>
      (entriesByDay[day.iso] ?? []).filter((e) => e.kind === 'deadline' || !e.time).length +
      (googleEventsByDay[day.iso] ?? []).filter((e) => e.allDay).length,
  );
  const overflowing = allDayCounts.some((count) => count > ALL_DAY_LINES);

  /* Open on the part of the day that matters: just before now this week,
     otherwise just before the first timed thing, or the working morning. */
  const weekKey = days[0]?.iso;
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const hasToday = days.some((d) => d.isToday);
    const firstTimed = days
      .flatMap((d) => entriesByDay[d.iso] ?? [])
      .map((e) => (e.kind === 'scheduled' && e.time ? toMinutes(e.time) : null))
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)[0];
    const target = hasToday
      ? jerusalemMinutes(new Date()) - 120
      : Math.min(firstTimed ?? 8 * 60, 8 * 60) - 30;
    container.scrollTop = Math.max(0, target) * PX_PER_MINUTE;
    // Only when the week changes — not every time an entry moves.
  }, [weekKey]);

  return (
    <div
      ref={scrollRef}
      style={{ '--cal-hour': `${HOUR_PX}px` } as React.CSSProperties}
      className="cal-scroll relative max-h-[max(30rem,calc(100dvh-16rem))] overflow-auto rounded-xl border border-line bg-surface"
    >
      <div className="min-w-[46rem]">
        <div className="sticky top-0 z-10 border-be border-line bg-surface">
          {/* Day headers */}
          <div className={GRID_COLUMNS}>
            <div aria-hidden />
            {days.map((day) => (
              <button
                key={day.iso}
                type="button"
                onClick={() => onSelectDay(day.iso)}
                aria-label={`${day.weekdayLong} ${day.dayOfMonth} — פתיחת היום`}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-1 pb-1.5 pt-2.5 transition-colors hover:bg-surface-2',
                  selectedDay === day.iso && 'bg-accent-soft/50',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm">
                  <span className={day.isToday ? 'font-bold text-ink' : 'text-muted'}>
                    {day.weekdayLong.replace('יום ', '')}
                  </span>
                  <span
                    className={cn(
                      'num grid h-6 min-w-6 place-items-center rounded-md px-1 leading-none',
                      day.isToday
                        ? 'bg-accent font-bold text-[var(--on-accent)]'
                        : 'font-semibold text-ink-2',
                    )}
                  >
                    {day.dayOfMonth}
                  </span>
                </span>
                <span className="text-[0.6875rem] leading-none text-muted">
                  {day.hebrewMonthLabel ? `${day.hebrewDay} ${day.hebrewMonthLabel}` : day.hebrewDay}
                </span>
              </button>
            ))}
          </div>

          {/* All day */}
          <div className={GRID_COLUMNS}>
            <div className="flex flex-col items-center gap-1 pt-2 text-[0.6875rem] text-muted">
              <span>כל היום</span>
              {overflowing && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  aria-label={expanded ? 'צמצום שורת כל היום' : 'הרחבת שורת כל היום'}
                  className="grid size-6 place-items-center rounded-md hover:bg-surface-2 hover:text-ink"
                >
                  <ChevronDown
                    className={cn('size-4 transition-transform', expanded && 'rotate-180')}
                    aria-hidden
                  />
                </button>
              )}
            </div>
            {days.map((day) => (
              <AllDayCell
                key={day.iso}
                day={day}
                entries={entriesByDay[day.iso] ?? []}
                googleEvents={googleEventsByDay[day.iso] ?? []}
                expanded={expanded}
                onExpand={() => setExpanded(true)}
              />
            ))}
          </div>
        </div>

        {/* Hours */}
        <div className={cn(GRID_COLUMNS, 'relative')}>
          <div className="relative" style={{ height: 24 * HOUR_PX }} aria-hidden>
            {HOURS.map((hour) =>
              hour === 0 ? null : (
                <span
                  key={hour}
                  className={cn(
                    'num absolute inset-x-0 -translate-y-1/2 text-center text-[0.6875rem] text-muted',
                    // Give way to the red "now" label rather than overprint it.
                    now !== null && days.some((d) => d.isToday) && Math.abs(now - hour * 60) < 14 && 'opacity-0',
                  )}
                  style={{ top: hour * HOUR_PX }}
                >
                  {fromMinutes(hour * 60)}
                </span>
              ),
            )}
            {now !== null && days.some((d) => d.isToday) && (
              <span
                className="num absolute inset-x-0 z-[4] -translate-y-1/2 text-center text-[0.6875rem] font-bold text-accent"
                style={{ top: now * PX_PER_MINUTE }}
              >
                {fromMinutes(now)}
              </span>
            )}
          </div>

          {days.map((day) => (
            <TimeColumn
              key={day.iso}
              day={day}
              entries={entriesByDay[day.iso] ?? []}
              googleEvents={googleEventsByDay[day.iso] ?? []}
              now={now}
              weekHasToday={days.some((d) => d.isToday)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AllDayCell({
  day,
  entries,
  googleEvents,
  expanded,
  onExpand,
}: {
  day: CalendarDay;
  entries: CalendarEntry[];
  googleEvents: GoogleEventDTO[];
  expanded: boolean;
  onExpand: () => void;
}) {
  const { quickAdd } = useCalendarActions();
  const { setNodeRef, isOver } = useDroppable({
    id: `allday:${day.iso}`,
    data: { iso: day.iso, zone: 'allday' },
  });

  const allDayEvents = googleEvents.filter((e) => e.allDay);
  const untimed = entries.filter((e) => e.kind === 'scheduled' && !e.time);
  const deadlines = entries.filter((e) => e.kind === 'deadline');
  const items = [
    ...allDayEvents.map((event) => ({ key: event.id, node: <GoogleEventRow event={event} compact /> })),
    ...untimed.map((entry) => ({ key: entry.key, node: <EntryChip entry={entry} compact /> })),
    ...deadlines.map((entry) => ({ key: entry.key, node: <EntryChip entry={entry} compact /> })),
  ];
  const limit = expanded || items.length <= ALL_DAY_LINES ? items.length : ALL_DAY_LINES - 1;
  const hidden = items.length - limit;

  return (
    <div
      ref={setNodeRef}
      data-day={day.iso}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button, a')) return;
        quickAdd({ iso: day.iso, time: null, x: event.clientX, y: event.clientY });
      }}
      className={cn(
        'flex min-h-[3.25rem] min-w-0 cursor-pointer flex-col gap-0.5 border-s border-line p-1 transition-colors',
        day.isWeekend && 'bg-surface-sunk/60',
        isOver && 'bg-accent-soft',
      )}
    >
      {items.slice(0, limit).map((item) => (
        <div key={item.key} className="min-w-0">
          {item.node}
        </div>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={onExpand}
          className="self-start rounded-sm px-1.5 text-start text-xs font-semibold text-muted hover:text-ink"
        >
          עוד <span className="num">{hidden}</span>
        </button>
      )}
    </div>
  );
}

type TimedItem =
  | { kind: 'task'; start: number; end: number; entry: CalendarEntry }
  | { kind: 'event'; start: number; end: number; event: GoogleEventDTO };

function TimeColumn({
  day,
  entries,
  googleEvents,
  now,
  weekHasToday,
}: {
  day: CalendarDay;
  entries: CalendarEntry[];
  googleEvents: GoogleEventDTO[];
  now: number | null;
  weekHasToday: boolean;
}) {
  const { quickAdd, draft } = useCalendarActions();
  const { setNodeRef, isOver } = useDroppable({
    id: `time:${day.iso}`,
    data: { iso: day.iso, zone: 'time' },
  });

  const placed = useMemo(() => {
    const items: TimedItem[] = [];
    for (const entry of entries) {
      if (entry.kind !== 'scheduled' || !entry.time) continue;
      const start = toMinutes(entry.time);
      if (start === null) continue;
      const duration = entry.task.durationMinutes ?? DEFAULT_TASK_MINUTES;
      items.push({ kind: 'task', start, end: Math.min(start + duration, MINUTES_IN_DAY), entry });
    }
    for (const event of googleEvents) {
      if (event.allDay) continue;
      // An event that runs past midnight is clipped to the part on this day.
      const start = event.startDay === day.iso ? jerusalemMinutes(event.startAt) : 0;
      const end = event.endDay === day.iso ? jerusalemMinutes(event.endAt) : MINUTES_IN_DAY;
      items.push({ kind: 'event', start, end: Math.max(end, start + 15), event });
    }
    return layoutSpans(items);
  }, [entries, googleEvents, day.iso]);

  const drafting = draft?.iso === day.iso && draft.time ? toMinutes(draft.time) : null;

  return (
    <div
      ref={setNodeRef}
      data-timecol={day.iso}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button, a, [data-block]')) return;
        const rect = event.currentTarget.getBoundingClientRect();
        // New tasks start on the half hour you clicked in.
        const minutes = Math.floor((event.clientY - rect.top) / PX_PER_MINUTE / 30) * 30;
        quickAdd({
          iso: day.iso,
          time: fromMinutes(Math.min(minutes, MINUTES_IN_DAY - 30)),
          x: event.clientX,
          y: event.clientY,
        });
      }}
      style={{ height: 24 * HOUR_PX }}
      className={cn(
        'cal-hours relative cursor-pointer border-s border-line',
        day.isWeekend && 'bg-surface-sunk/60',
        isOver && 'bg-accent-soft/60',
      )}
    >
      {placed.map(({ item, lane, lanes }) =>
        item.kind === 'task' ? (
          <TimeBlock
            key={item.entry.key}
            entry={item.entry}
            start={item.start}
            end={item.end}
            lane={lane}
            lanes={lanes}
          />
        ) : (
          <EventBlock key={item.event.id} item={item} lane={lane} lanes={lanes} />
        ),
      )}

      {drafting !== null && (
        <div
          aria-hidden
          style={{ top: drafting * PX_PER_MINUTE + 1, height: 30 * PX_PER_MINUTE - 2 }}
          className="pointer-events-none absolute inset-x-0.5 z-[3] flex items-center rounded-md border border-dashed border-accent bg-accent-soft px-2 text-xs font-semibold text-accent"
        >
          <span className="num">{draft?.time}</span>
          <span className="ms-1.5">משימה חדשה</span>
        </div>
      )}

      {now !== null && weekHasToday && (
        <div
          aria-hidden
          className={cn('pointer-events-none absolute inset-x-0 z-[4]', day.isToday ? 'h-0.5 bg-accent' : 'h-px bg-accent/35')}
          style={{ top: now * PX_PER_MINUTE }}
        >
          {day.isToday && (
            <span className="absolute -top-[3px] -inset-s-1 size-2 rounded-full bg-accent" />
          )}
        </div>
      )}
    </div>
  );
}

/** A Google event among the tasks: white, with the calendar's bar on its edge,
 *  so it never reads as a task you could tick. */
function EventBlock({
  item,
  lane,
  lanes,
}: {
  item: Extract<TimedItem, { kind: 'event' }>;
  lane: number;
  lanes: number;
}) {
  const { event, start, end } = item;
  const roomy = end - start >= 40;
  const Tag = event.htmlLink ? 'a' : 'div';
  return (
    <Tag
      data-block
      {...(event.htmlLink
        ? { href: event.htmlLink, target: '_blank', rel: 'noopener noreferrer' }
        : {})}
      title={`${event.title} · ${event.calendar}${event.location ? ` · ${event.location}` : ''}`}
      style={{
        top: start * PX_PER_MINUTE + 1,
        height: Math.max(end - start, 15) * PX_PER_MINUTE - 2,
        insetInlineStart: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 5px)`,
      }}
      className={cn(
        'group/event @container absolute z-[1] flex overflow-hidden rounded-md border border-line border-s-[3px] border-s-accent bg-surface px-1.5 text-start shadow-row',
        'hover:z-[2] hover:border-line-strong hover:border-s-accent',
        roomy ? 'flex-col pt-1' : 'items-center gap-1.5',
      )}
    >
      <span dir="auto" className={cn('min-w-0 text-xs font-semibold leading-4 text-ink', roomy ? 'line-clamp-2' : 'truncate')}>
        {event.title}
      </span>
      <span className={cn('num shrink-0 items-center gap-1 whitespace-nowrap text-[0.6875rem] leading-4 text-muted', roomy ? 'hidden @[5.5rem]:flex' : 'hidden @[10rem]:flex')}>
        {formatRange(start, end)}
        {event.htmlLink && roomy && (
          <ExternalLink className="size-3 opacity-0 transition-opacity group-hover/event:opacity-100" aria-hidden />
        )}
      </span>
    </Tag>
  );
}

/** Minutes since midnight in Israel, ticking each minute. Null until mounted,
 *  so the server and the first client render agree. */
function useNowMinutes(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(jerusalemMinutes(new Date()));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
