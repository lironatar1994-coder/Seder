import Link from 'next/link';
import { ArrowUpLeft, Flag, Users, CheckCheck } from 'lucide-react';
import { getTodayInsights, type SidebarData } from '@/server/tasks/queries';
import { relativeDayLabel, today, weekdayName } from '@/lib/dates';
import { FocusTimer } from './focus-timer';

export async function TodayInsights({ userId, projects }: { userId: string; projects: SidebarData['projects'] }) {
  const data = await getTodayInsights(userId); const max = Math.max(1, ...data.days.map((day) => day.count));
  const shared = projects.filter((project) => project.memberCount > 0 || project.joined).slice(0, 3);
  return <aside className="today-insights" aria-label="תכנון ומיקוד">
    <section className="insight-section"><div className="flex items-center justify-between"><h2 className="text-base font-bold">השבוע הקרוב</h2><Link href="/app/calendar?v=week" aria-label="פתיחת השבוע בלוח השנה" className="text-muted hover:text-accent"><ArrowUpLeft className="size-4" aria-hidden /></Link></div><p className="mt-1 text-sm text-muted">למצוא מקום לכל מה שחשוב.</p><div className="week-outlook">{data.days.map((day, index) => <Link href={`/app/calendar?w=${day.iso}&d=${day.iso}&v=week`} key={day.iso} className={`week-outlook-day ${index === 0 ? 'week-outlook-today' : ''}`} aria-label={`${weekdayName(new Date(`${day.iso}T00:00:00Z`))}: ${day.count} משימות`}><span className="num text-xs">{day.count}</span><span className="week-outlook-track"><span style={{ height: `${Math.max(4, day.count / max * 100)}%` }} /></span><span className="text-xs">{['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][new Date(`${day.iso}T00:00:00Z`).getUTCDay()]}</span></Link>)}</div><p className="mt-4 flex items-center gap-2 text-sm text-muted"><CheckCheck className="size-4 text-accent" aria-hidden /><span><b className="num text-ink">{data.completed}</b> הושלמו ב־7 הימים האחרונים</span></p></section>
    <FocusTimer />
    {data.deadlines.length > 0 && <section className="insight-section"><h2 className="mb-3 flex items-center gap-2 text-base font-bold"><Flag className="size-4 text-flag" aria-hidden />מועדי הגשה</h2><ul className="space-y-3">{data.deadlines.map((task) => <li key={task.id}><Link href={task.projectId ? `/app/project/${task.projectId}?task=${task.id}` : `/app/inbox?task=${task.id}`} className="block text-sm hover:text-accent"><span dir="auto" className="line-clamp-2">{task.title}</span><span className="mt-1 block text-xs text-flag">{relativeDayLabel(task.deadline!, today())}</span></Link></li>)}</ul></section>}
    {shared.length > 0 && <section className="insight-section"><h2 className="mb-3 flex items-center gap-2 text-base font-bold"><Users className="size-4 text-accent" aria-hidden />מתקדמים ביחד</h2>{shared.map((project) => <Link key={project.id} href={`/app/project/${project.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-accent"><span className="truncate">{project.name}</span><span className="num shrink-0 text-xs text-muted">{project.openCount} פתוחות</span></Link>)}</section>}
  </aside>;
}
