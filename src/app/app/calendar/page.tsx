import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/server/auth/session';
import { getCalendarView, getSidebarData } from '@/server/tasks/queries';
import { today } from '@/lib/dates';
import { buildMonthGrid, buildWeekGrid, parseMonthAnchor, parseISODay } from '@/lib/calendar';
import { CalendarView } from '@/components/calendar/calendar-view';

export const metadata: Metadata = { title: 'לוח שנה · סדר' };

type Search = { m?: string; w?: string; v?: string; d?: string };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const params = await searchParams;
  const base = today();
  const mode = params.v === 'week' ? 'week' : 'month';

  // The visible range comes from the grid itself, so the query fetches exactly
  // the padding days the month view already renders — no more, no less.
  const grid =
    mode === 'week'
      ? buildWeekGrid(
          params.w && /^\d{4}-\d{2}-\d{2}$/.test(params.w) ? parseISODay(params.w) : base,
          base,
        )
      : buildMonthGrid(parseMonthAnchor(params.m, base), base);

  const days = 'weeks' in grid ? grid.days : grid.days;
  const [calendar, sidebar] = await Promise.all([
    getCalendarView(user.id, days[0].iso, days[days.length - 1].iso),
    getSidebarData(user.id),
  ]);

  return (
    <CalendarView
      mode={mode}
      grid={grid}
      calendar={calendar}
      projects={sidebar.projects}
      labels={sidebar.labels}
      selectedDay={params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : null}
    />
  );
}
