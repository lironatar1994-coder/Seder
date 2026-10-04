import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { getSidebarData } from '@/server/tasks/queries';
import { ViewHeader } from '@/components/nav/view-header';
import { ViewActions } from '@/components/nav/view-actions';
import { TodayInsights } from '@/components/task/today-insights';

export const metadata = { title: 'מיקוד ותכנון · סדר' };
export default async function FocusPage() {
  const user = await getCurrentUser();
  if (!user) notFound();
  const sidebar = await getSidebarData(user.id);
  return <><ViewHeader title="מיקוד ותכנון" subtitle="זמן לעבוד על דבר אחד, ומבט על השבוע." action={<ViewActions />} /><TodayInsights userId={user.id} projects={sidebar.projects} /></>;
}
