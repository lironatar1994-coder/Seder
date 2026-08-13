import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { logoutAction } from '@/server/auth/actions';
import { getSidebarData } from '@/server/tasks/queries';
import { Sidebar } from '@/components/nav/sidebar';
import { TabBar } from '@/components/nav/tab-bar';
import { CommandPalette } from '@/components/nav/command-palette';
import { ViewTransitions } from '@/components/nav/view-transitions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The middleware only checked that a cookie exists. This is where the session
  // is actually verified — an expired or forged cookie stops here.
  //
  // Redirecting to /login directly would loop: the middleware sees the stale
  // cookie and sends the visitor back here. /signed-out deletes it first.
  const user = await getCurrentUser();
  if (!user) redirect('/signed-out');

  const sidebar = await getSidebarData(user.id);

  return (
    <div data-app-shell className="flex h-dvh overflow-hidden bg-paper max-md:flex-col">
      <Sidebar data={sidebar} user={user} onLogout={logoutAction} />
      {/* Only this column scrolls — the sidebar stays put. */}
      <main className="view-surface scroll-quiet min-w-0 flex-1 overflow-y-auto">
        {/* A single reading column. Hebrew runs shorter than English for the
            same content, so 44rem keeps the line length comfortable.
            A page that is a grid rather than prose — the calendar — opts out by
            marking its root `data-wide`. */}
        <div className="mx-auto w-full max-w-[44rem] px-4 has-[[data-wide]]:max-w-[82rem] md:px-8">
          {children}
        </div>
        {/* The tab bar is fixed, so the column owes it a floor to scroll to.
            Without this the last task sits under the bar and cannot be read,
            which is the classic bottom-navigation bug. */}
        <div aria-hidden className="h-[var(--tab-bar)]" />
      </main>
      <ViewTransitions />
      <TabBar counts={sidebar.counts} />
      <CommandPalette projects={sidebar.projects} labels={sidebar.labels} />
    </div>
  );
}
