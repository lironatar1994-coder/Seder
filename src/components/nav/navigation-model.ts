import { BookCheck, CalendarDays, Inbox, Layers, Moon, Star, type LucideIcon } from 'lucide-react';
import { VIEWS, type ViewSlug } from '@/lib/constants';
import type { SidebarData } from '@/server/tasks/queries';

const icons: Record<ViewSlug, LucideIcon> = { inbox: Inbox, today: Star, upcoming: CalendarDays, anytime: Layers, someday: Moon, logbook: BookCheck };
const colors: Record<ViewSlug, string> = { inbox: 'var(--notice)', today: 'var(--date-tomorrow)', upcoming: 'var(--date-week)', anytime: 'var(--date-today)', someday: 'var(--date-later)', logbook: 'var(--rail-muted)' };
export const NAVIGATION_VIEWS = VIEWS.map(view => ({ ...view, href: `/app/${view.slug}`, icon: icons[view.slug], color: colors[view.slug] }));
export const MOBILE_VIEWS = NAVIGATION_VIEWS.slice(0, 3).map(view => ({ ...view, tabLabel: view.slug === 'inbox' ? 'תיבה' : view.label }));
export const COLLECTIONS_LABEL = 'רשימות';
export function taskCountLabel(count: number) { return count === 1 ? 'משימה פתוחה אחת' : `${count} משימות פתוחות`; }
export function workspaceLocation(pathname: string, filterId: string | null, data: Pick<SidebarData, 'projects' | 'labels' | 'savedFilters'>) {
  const view = NAVIGATION_VIEWS.find(item => pathname === item.href);
  if (view) return { label: view.label, parent: 'המשימות שלי' };
  const project = data.projects.find(item => pathname === `/app/project/${item.id}`);
  if (project) return { label: project.name, parent: project.joined ? 'שותפו איתי' : 'פרויקטים' };
  const label = data.labels.find(item => pathname === `/app/label/${item.id}`);
  if (label) return { label: label.name, parent: 'תוויות' };
  if (pathname === '/app/filters') return { label: data.savedFilters.find(item => item.id === filterId)?.name ?? 'מסננים ותוויות', parent: 'המרחב שלי' };
  return { label: pathname.startsWith('/app/calendar') ? 'לוח שנה' : pathname === '/app/focus' ? 'מיקוד ותכנון' : pathname === '/app/projects' ? 'כל הפרויקטים' : 'הגדרות', parent: 'המרחב שלי' };
}
