import { BookCheck, CalendarDays, Inbox, Star, type LucideIcon } from 'lucide-react';
import { VIEWS, type ViewSlug } from '@/lib/constants';
import type { SidebarData } from '@/server/tasks/queries';

export interface Destination {
  slug: ViewSlug | 'calendar';
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  color: string;
  /** Which sidebar count it shows, if any. */
  countKey?: ViewSlug;
}

const view = (slug: ViewSlug, icon: LucideIcon, color: string): Destination => {
  const meta = VIEWS.find(item => item.slug === slug)!;
  return { slug, label: meta.label, hint: meta.hint, href: `/app/${slug}`, icon, color, countKey: slug };
};

/** Todoist's top of the sidebar — Inbox, Today, Upcoming — with the calendar in
 *  Upcoming's place: the days ahead are a calendar here, not another list. */
export const PRIMARY_DESTINATIONS: Destination[] = [
  view('inbox', Inbox, 'var(--notice)'),
  view('today', Star, 'var(--date-tomorrow)'),
  { slug: 'calendar', label: 'לוח שנה', hint: 'הימים הבאים, בשבוע ובחודש', href: '/app/calendar', icon: CalendarDays, color: 'var(--date-week)' },
];
/** Completed work, after Filters & Labels — where Todoist keeps it. */
export const HISTORY_DESTINATION = view('logbook', BookCheck, 'var(--rail-muted)');
/** Ctrl+1…5, in sidebar order. */
export const SHORTCUT_HREFS = [...PRIMARY_DESTINATIONS.map(item => item.href), '/app/filters', HISTORY_DESTINATION.href];
export const MOBILE_VIEWS = PRIMARY_DESTINATIONS.map(item => ({ ...item, tabLabel: item.slug === 'inbox' ? 'תיבה' : item.slug === 'calendar' ? 'לוח' : item.label }));
export function isDestinationActive(item: Destination, pathname: string) {
  return item.slug === 'calendar' ? pathname.startsWith(item.href) : pathname === item.href;
}
export const COLLECTIONS_LABEL = 'רשימות';
export function taskCountLabel(count: number) { return count === 1 ? 'משימה פתוחה אחת' : `${count} משימות פתוחות`; }
export function workspaceLocation(pathname: string, filterId: string | null, data: Pick<SidebarData, 'projects' | 'labels' | 'savedFilters'>) {
  const listView = [...PRIMARY_DESTINATIONS, HISTORY_DESTINATION].find(item => item.slug !== 'calendar' && pathname === item.href);
  if (listView) return { label: listView.label, parent: 'המשימות שלי' };
  const project = data.projects.find(item => pathname === `/app/project/${item.id}`);
  if (project) return { label: project.name, parent: project.joined ? 'שותפו איתי' : 'פרויקטים' };
  const label = data.labels.find(item => pathname === `/app/label/${item.id}`);
  if (label) return { label: label.name, parent: 'תוויות' };
  if (pathname === '/app/filters') return { label: data.savedFilters.find(item => item.id === filterId)?.name ?? 'מסננים ותוויות', parent: 'המרחב שלי' };
  return { label: pathname.startsWith('/app/calendar') ? 'לוח שנה' : pathname === '/app/focus' ? 'מיקוד ותכנון' : pathname === '/app/projects' ? 'כל הפרויקטים' : 'הגדרות', parent: 'המרחב שלי' };
}
