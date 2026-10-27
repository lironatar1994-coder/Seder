import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/server/auth/session';
import { getLogbookPage, getSidebarData, getViewTasks } from '@/server/tasks/queries';
import { LogbookView } from '@/components/task/logbook-view';
import { RETIRED_VIEWS, VIEWS, isViewSlug, type ViewSlug } from '@/lib/constants';
import { ViewHeader } from '@/components/nav/view-header';
import { TaskList } from '@/components/task/task-list';
import { ViewActions } from '@/components/nav/view-actions';
import { getGoogleEvents } from '@/server/google/queries';
import { GoogleEventList, GoogleSyncBar } from '@/components/calendar/google-events';
import { db } from '@/server/db';
import { today } from '@/lib/dates';

/* Empty screens are invitations, not apologies — each one says what this view
   is for and offers the next action. */
const EMPTY: Record<ViewSlug, { title: string; body: string }> = {
  inbox: {
    title: 'התיבה ריקה',
    body: 'כל משימה שעוד לא שויכה לפרויקט יושבת כאן — גם אם כבר יש לה תאריך. הכול מסודר.',
  },
  today: {
    title: 'אין משימות להיום',
    body: 'שום דבר לא מתוזמן להיום ואין דדליינים פתוחים. אפשר למשוך משהו מלוח השנה או להוסיף משימה.',
  },
  logbook: {
    title: 'עוד לא נסגרה משימה',
    body: 'כל מה שתשלימו יופיע כאן, מהחדש לישן.',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}): Promise<Metadata> {
  const { view } = await params;
  const match = VIEWS.find((v) => v.slug === view);
  return { title: match ? `${match.label} · סדר` : 'סדר' };
}

export default async function ViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  // Old bookmarks to a folded view land on the place that replaced it.
  if (RETIRED_VIEWS[view]) permanentRedirect(RETIRED_VIEWS[view]);
  if (!isViewSlug(view)) notFound();

  const user = await getCurrentUser();
  if (!user) notFound();

  const meta = VIEWS.find((v) => v.slug === view)!;

  // The logbook paginates, so it fetches a page rather than a whole view and
  // renders a client component that can append to it.
  if (view === 'logbook') {
    const [page, sidebar] = await Promise.all([
      getLogbookPage(user.id),
      getSidebarData(user.id),
    ]);
    return (
      <>
        <ViewHeader title={meta.label} subtitle={meta.hint} />
        <LogbookView initial={page} projects={sidebar.projects} labels={sidebar.labels} />
      </>
    );
  }

  const showGoogle = view === 'today';
  const from = today();
  const to = today();
  const [data, sidebar, googleEvents, googleConnection] = await Promise.all([
    getViewTasks(user.id, view),
    getSidebarData(user.id),
    showGoogle ? getGoogleEvents(user.id, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)) : Promise.resolve([]),
    showGoogle ? db.googleCalendarConnection.findUnique({ where: { userId: user.id }, select: { lastError: true } }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <ViewHeader
        title={meta.label}
        subtitle={view === 'today' ? null : meta.hint}
        showDate={view === 'today'}
        count={view === 'today' ? data.groups.reduce((sum, group) => sum + group.tasks.length, 0) : undefined}
        progress={data.progress}
        action={<ViewActions planning={view === 'today'} />}
      />
      <div className={view === 'today' ? 'today-workspace' : undefined}>
      <div className="min-w-0">
      {googleConnection && <GoogleSyncBar connected lastError={googleConnection.lastError} />}
      <GoogleEventList events={googleEvents} />
      <TaskList
        groups={data.groups}
        context={{ view }}
        projects={sidebar.projects}
        labels={sidebar.labels}
        empty={EMPTY[view]}
      />
      </div>
      </div>
    </div>
  );
}
