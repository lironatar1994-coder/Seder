'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flag, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { swatchVar } from '@/lib/constants';
import { WEEKDAY_HEADERS, parseISODay, type CalendarDay } from '@/lib/calendar';
import { formatShortDate, relativeDayLabel, today, weekdayName } from '@/lib/dates';
import type { CalendarEntry } from '@/server/tasks/queries';
import { Composer } from '@/components/task/composer';
import { registerComposer } from '@/components/task/compose-bus';
import { useIsPhone } from '@/components/ui/use-is-phone';
import { EntryRow } from './entry-row';
import { GoogleEventRow } from './google-events';
import type { GoogleEventDTO } from '@/lib/calendar-event-types';

/**
 * The calendar, on a phone.
 *
 * A month grid on a 390px screen gives each day about 50px, which is not
 * enough for a title — so the phone used to show coloured dots and hide the
 * work behind a tap. Todoist and Things both refuse that trade: neither ships
 * a month grid on a phone. Todoist puts a week strip over a day-grouped
 * agenda; Things drops the grid entirely and lists days in order. This is the
 * first of those, because the strip is what keeps "which week am I looking at"
 * answerable without scrolling.
 *
 * The grid still exists for pointers, where 150px cells make chips legible.
 * Same data, two shapes — not one shape squeezed.
 */

/** Dots on a strip cell, matching the colours the desktop grid uses. */
const MAX_DOTS = 3;

export interface AgendaProps {
  /** Every day in the fetched window, in order. 42 in month mode, 7 in week. */
  days: CalendarDay[];
  /** Pre-chunked weeks; month mode only. Week mode passes a single row. */
  weeks: CalendarDay[][];
  entriesByDay: Record<string, CalendarEntry[]>;
  googleEventsByDay?: Record<string, GoogleEventDTO[]>;
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  /** From `?d=` — which day the strip should open on. */
  initialDay: string | null;
  /** Where a chevron goes when it runs out of weeks inside this window. */
  boundaryHref: (direction: -1 | 1, sundayIso: string) => string;
  onOpenTask: (taskId: string) => void;
}

export function Agenda({
  days,
  weeks,
  entriesByDay,
  googleEventsByDay = {},
  projects,
  labels,
  initialDay,
  boundaryHref,
  onOpenTask,
}: AgendaProps) {
  const isPhone = useIsPhone();

  /* Today comes from the server-built grid, never from `new Date()`. The grid
     was built at request time; reading the clock again during render would
     disagree with it across midnight, and disagree with the server on the
     first paint. */
  const todayIso = useMemo(() => days.find((day) => day.isToday)?.iso ?? null, [days]);

  /* Where the agenda starts. Padding days from the previous month are noise on
     a phone — nobody scrolls up into last month — but a month in the past has
     no "today" to start from, so it falls back to its own first real day. */
  const startIso = useMemo(() => {
    if (todayIso && days.some((day) => day.iso === todayIso)) return todayIso;
    return (days.find((day) => day.inMonth) ?? days[0])?.iso ?? null;
  }, [days, todayIso]);

  const sections = useMemo(
    () => (startIso ? days.filter((day) => day.iso >= startIso) : days),
    [days, startIso],
  );

  const [focusIso, setFocusIso] = useState(() => initialDay ?? startIso ?? days[0]?.iso ?? '');
  const [composerIso, setComposerIso] = useState<string | null>(null);

  /** Which week the strip is showing. Seeded to the row holding the focus. */
  const [row, setRow] = useState(() => {
    const target = initialDay ?? todayIso ?? startIso;
    const found = weeks.findIndex((week) => week.some((day) => day.iso === target));
    return found >= 0 ? found : 0;
  });

  const stripDays = weeks[Math.min(row, weeks.length - 1)] ?? days.slice(0, 7);

  /* Scroll-spy has to be silenced while a tap-driven scroll is in flight, or
     the sections streaming past under the strip drag the highlight with them
     and it lands somewhere the user did not choose. A ref, not state: this
     must take effect before the next scroll event, not after a render. */
  const suppressSpy = useRef(false);
  const focusRef = useRef(focusIso);
  focusRef.current = focusIso;

  const scrollToDay = useCallback((iso: string) => {
    const section = document.querySelector<HTMLElement>(`[data-agenda-day="${iso}"]`);
    if (!section) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    suppressSpy.current = true;
    section.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });

    const scroller = section.closest('main');
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      suppressSpy.current = false;
      scroller?.removeEventListener('scrollend', release);
    };
    scroller?.addEventListener('scrollend', release, { once: true });
    // Safari only got `scrollend` in 18.4, and a scroll that never moves —
    // tapping the day already at the top — fires nothing at all.
    setTimeout(release, 1000);
  }, []);

  const pickDay = useCallback(
    (iso: string) => {
      setFocusIso(iso);
      scrollToDay(iso);
    },
    [scrollToDay],
  );

  /* The tab bar's "חדשה" asks whoever is mounted to open a composer. Without
     this it falls back to /app/today, which quietly moves the task off the day
     the user was looking at. */
  useEffect(() => {
    if (!isPhone) return;
    return registerComposer(() => {
      const iso = focusRef.current;
      setComposerIso(iso);
      scrollToDay(iso);
    });
  }, [isPhone, scrollToDay]);

  /* Highlight the day the reader has actually scrolled to. Only on a phone:
     the agenda is `display:none` above md, and observing hidden sections would
     be pure cost. */
  useEffect(() => {
    if (!isPhone) return;

    const headers = document.querySelectorAll<HTMLElement>('[data-agenda-day]');
    if (!headers.length) return;
    const scroller = headers[0].closest('main');

    const observer = new IntersectionObserver(
      (records) => {
        if (suppressSpy.current) return;
        const top = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const iso = top?.target.getAttribute('data-agenda-day');
        if (iso) setFocusIso(iso);
      },
      {
        root: scroller,
        // A band just under the strip: "current" is the day whose header has
        // reached the top of the readable area, not one merely on screen.
        rootMargin: '-120px 0px -65% 0px',
        threshold: 0,
      },
    );

    headers.forEach((header) => observer.observe(header));
    return () => observer.disconnect();
  }, [isPhone, sections.length]);

  const vocabulary = useMemo(
    () => ({ projects: projects.map((p) => p.name), labels: labels.map((l) => l.name) }),
    [projects, labels],
  );

  const firstSunday = stripDays[0]?.iso;
  const canStepBack = row > 0;
  const canStepForward = row < weeks.length - 1;

  return (
    <div className="md:hidden">
      {/* Full-bleed, and it has to be: the column pads 16px a side, which at
          320px would leave 41px per cell — under the touch floor. Bleeding
          into that padding buys back the 45px the seven cells need. */}
      <div className="sticky inset-bs-0 z-20 -mx-4 border-be border-line bg-paper">
        <div className="flex items-center justify-between px-1">
          <StripArrow
            direction={-1}
            disabled={false}
            asLink={!canStepBack}
            href={firstSunday ? boundaryHref(-1, firstSunday) : '#'}
            onClick={() => setRow((current) => Math.max(0, current - 1))}
          />
          <span className="num text-xs text-muted">{stripLabel(stripDays)}</span>
          <StripArrow
            direction={1}
            disabled={false}
            asLink={!canStepForward}
            href={firstSunday ? boundaryHref(1, firstSunday) : '#'}
            onClick={() => setRow((current) => Math.min(weeks.length - 1, current + 1))}
          />
        </div>

        <div className="grid grid-cols-7">
          {stripDays.map((day, index) => {
            const entries = entriesByDay[day.iso] ?? [];
            const selected = day.iso === focusIso;
            const reachable = !startIso || day.iso >= startIso;
            return (
              <button
                key={day.iso}
                type="button"
                data-strip-day={day.iso}
                aria-current={selected ? 'date' : undefined}
                aria-label={`${day.weekdayLong} ${day.dayOfMonth}, ${entries.length + (googleEventsByDay[day.iso]?.length ?? 0)} פריטים`}
                onClick={() => pickDay(reachable ? day.iso : (startIso ?? day.iso))}
                className={cn(
                  'flex min-h-11 flex-col items-center justify-center gap-1 py-1.5',
                  'transition-colors duration-120',
                  selected && 'bg-accent-soft',
                  !reachable && 'opacity-40',
                )}
              >
                <span className="text-[0.65rem] leading-none text-muted">
                  {WEEKDAY_HEADERS[index]}
                </span>
                <span
                  className={cn(
                    'num grid size-6 place-items-center rounded-full text-sm leading-none',
                    day.isToday
                      ? 'bg-accent font-bold text-[var(--on-accent)]'
                      : selected
                        ? 'font-bold text-accent'
                        : 'text-ink',
                  )}
                >
                  {day.dayOfMonth}
                </span>
                {/* A row of dots that is always the same height, so the cells
                    do not jitter between weeks with and without work. */}
                <span className="flex h-1 items-center gap-0.5">
                  {(googleEventsByDay[day.iso] ?? []).slice(0, Math.max(0, MAX_DOTS - entries.length)).map(event => <span key={event.id} className="size-1 rounded-full bg-accent" />)}
                  {entries.slice(0, MAX_DOTS).map((entry) => (
                    <span
                      key={entry.key}
                      className={cn(
                        'size-1 rounded-full',
                        entry.task.status !== 'TODO' && 'opacity-40',
                      )}
                      style={{
                        backgroundColor:
                          entry.kind === 'deadline'
                            ? 'var(--flag)'
                            : swatchVar(entry.task.project?.color ?? 'slate'),
                      }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pb-8">
        {sections.map((day) => {
          const entries = entriesByDay[day.iso] ?? [];
          const scheduled = entries.filter((entry) => entry.kind === 'scheduled');
          const deadlines = entries.filter((entry) => entry.kind === 'deadline');

          return (
            <section
              key={day.iso}
              data-agenda-day={day.iso}
              // Clears the sticky strip when a day is scrolled to.
              className="scroll-mt-28 border-be border-line py-3 last:border-be-0"
            >
              <DayHeading day={day} count={entries.length + (googleEventsByDay[day.iso]?.length ?? 0)} />
              <div className="space-y-1">{(googleEventsByDay[day.iso] ?? []).map(event => <GoogleEventRow key={event.id} event={event} />)}</div>

              {entries.length === 0 && !(googleEventsByDay[day.iso]?.length) && composerIso !== day.iso && (
                <p className="px-1 pb-1 text-sm text-muted">פנוי.</p>
              )}

              {scheduled.length > 0 && (
                <ul className="space-y-0.5">
                  {scheduled.map((entry) => (
                    <li key={entry.key}>
                      <EntryRow entry={entry} onOpen={onOpenTask} />
                    </li>
                  ))}
                </ul>
              )}

              {deadlines.length > 0 && (
                <div className="mt-2 space-y-1">
                  <h4 className="flex items-center gap-1.5 px-1 text-xs font-bold text-flag">
                    <Flag className="size-3" aria-hidden />
                    מועדי הגשה
                  </h4>
                  <ul className="space-y-0.5">
                    {deadlines.map((entry) => (
                      <li key={entry.key}>
                        <EntryRow entry={entry} onOpen={onOpenTask} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {composerIso === day.iso ? (
                <div className="mt-2 animate-fade-up">
                  <Composer
                    context={{ view: 'calendar', defaultDate: day.iso }}
                    vocabulary={vocabulary}
                    onClose={() => setComposerIso(null)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFocusIso(day.iso);
                    setComposerIso(day.iso);
                  }}
                  aria-label={`הוספת משימה ל${day.weekdayLong}`}
                  className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-start text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  משימה ליום הזה
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Heading for one day, built the same way the task list builds its groups. */
function DayHeading({ day, count }: { day: CalendarDay; count: number }) {
  const date = parseISODay(day.iso);
  const relative = relativeDayLabel(date, today());
  const weekday = weekdayName(date);
  const short = formatShortDate(date);

  // Beyond a week `relativeDayLabel` already returns the numeric date, and
  // using it as the heading would print the date twice.
  const primary = relative === short ? weekday : relative;
  const secondary = primary === weekday ? short : `${weekday} · ${short}`;

  return (
    <div className="mb-1 flex items-baseline gap-2 px-1">
      <h3
        className={cn(
          'text-sm font-bold',
          day.isToday ? 'text-accent' : 'text-ink',
        )}
      >
        {primary}
      </h3>
      <span className="num text-xs text-muted">{secondary}</span>
      <span className="display text-xs text-muted">{day.hebrewDay}</span>
      {day.hebrewMonthLabel && (
        <span className="text-xs font-semibold text-accent">{day.hebrewMonthLabel}</span>
      )}
      {count > 0 && <span className="num ms-auto text-xs text-muted">{count}</span>}
    </div>
  );
}

/**
 * A chevron that steps within the loaded weeks, or navigates once it runs out.
 *
 * The timeline runs along the reading direction, so in Hebrew "earlier" points
 * right — these are already the RTL glyphs, the same choice the grid's period
 * arrows make.
 */
function StripArrow({
  direction,
  asLink,
  href,
  onClick,
  disabled,
}: {
  direction: -1 | 1;
  asLink: boolean;
  href: string;
  onClick: () => void;
  disabled: boolean;
}) {
  const label = direction === -1 ? 'השבוע הקודם' : 'השבוע הבא';
  const glyph =
    direction === -1 ? (
      <ChevronRight className="size-4" aria-hidden />
    ) : (
      <ChevronLeft className="size-4" aria-hidden />
    );
  const className =
    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink';

  if (asLink) {
    return (
      <Link href={href} aria-label={label} className={className}>
        {glyph}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={className}>
      {glyph}
    </button>
  );
}

/** "10–16 באוגוסט", from the days themselves rather than a second date helper. */
function stripLabel(days: CalendarDay[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';
  return `${formatShortDate(parseISODay(first.iso))} – ${formatShortDate(parseISODay(last.iso))}`;
}
