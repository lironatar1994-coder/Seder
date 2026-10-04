import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/server/auth/session';
import { getLogbookPage, getSidebarData, getViewTasks } from '@/server/tasks/queries';
import { LogbookView } from '@/components/task/logbook-view';
import { VIEWS, isViewSlug, type ViewSlug } from '@/lib/constants';
import { ViewHeader } from '@/components/nav/view-header';
import { TaskList } from '@/components/task/task-list';
import { TodayInsights } from '@/components/task/today-insights';

/* Empty screens are invitations, not apologies — each one says what this view
   is for and offers the next action. */
const EMPTY: Record<ViewSlug, { title: string; body: string }> = {
  inbox: {
    title: 'התיבה ריקה',
    body: 'כל משימה שעוד לא שויכה לפרויקט יושבת כאן — גם אם כבר יש לה תאריך. הכול מסודר.',
  },
  today: {
    title: 'אין כלום להיום',
    body: 'שום דבר לא מתוזמן להיום ואין דדליינים פתוחים. אפשר למשוך משהו מ״בקרוב״ או להוסיף משימה.',
  },
  upcoming: {
    title: 'החודש הקרוב פנוי',
    body: 'אין משימות מתוזמנות לשלושים הימים הבאים.',
  },
  anytime: {
    title: 'אין משימות זמינות',
    body: 'משימות ששויכו לפרויקט, בלי תאריך, ומוכנות לביצוע מתי שמתאים.',
  },
  someday: {
    title: 'אין רעיונות שמורים',
    body: 'מקום לדברים שתרצו לעשות מתישהו, בלי להתחייב מתי.',
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

  const [data, sidebar] = await Promise.all([
    getViewTasks(user.id, view),
    getSidebarData(user.id),
  ]);

  return (
    <div data-wide={view === 'today' ? true : undefined}>
      <ViewHeader
        title={meta.label}
        subtitle={view === 'today' ? null : meta.hint}
        showDate={view === 'today'}
        progress={data.progress}
      />
      <div className={view === 'today' ? 'today-workspace' : undefined}>
      <div className="min-w-0">
      <TaskList
        groups={data.groups}
        context={{ view }}
        projects={sidebar.projects}
        labels={sidebar.labels}
        dayHeadings={view === 'upcoming'}
        // Upcoming is ordered by date, so dragging inside it would be a lie.
        // The logbook returned above and never reaches here.
        reorderable={view !== 'upcoming'}
        empty={EMPTY[view]}
      />
      </div>
      {view === 'today' && <TodayInsights userId={user.id} projects={sidebar.projects} />}
      </div>
    </div>
  );
}
