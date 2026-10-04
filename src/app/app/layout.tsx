import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { logoutAction } from '@/server/auth/actions';
import { getSidebarData } from '@/server/tasks/queries';
import { Sidebar } from '@/components/nav/sidebar';
import { TabBar } from '@/components/nav/tab-bar';
import { CommandPalette } from '@/components/nav/command-palette';
import { ViewTransitions } from '@/components/nav/view-transitions';
import { ReminderDefaultsProvider } from '@/components/task/reminder-defaults';
import { ComposerPreferencesProvider } from '@/components/task/composer-preferences';
import { readComposerPreferences } from '@/lib/composer-preferences';
import { envNumber } from '@/lib/env';
import { WorkspaceBar } from '@/components/nav/workspace-bar';
import { WhatsappIntroduction } from '@/components/nav/whatsapp-introduction';
import { shouldIntroduceWhatsapp } from '@/lib/whatsapp-onboarding';
import { readWhatsappState } from '@/server/whatsapp/status';
import { db } from '@/server/db';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The middleware only checked that a cookie exists. This is where the session
  // is actually verified — an expired or forged cookie stops here.
  //
  // /signed-out clears stale cookies before showing the sign-in page.
  const user = await getCurrentUser();
  if (!user) redirect('/signed-out');

  const sidebar = await getSidebarData(user.id);
  const [whatsappUser, whatsappState] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, whatsappReminders: true, whatsappIntroSeenAt: true, composerPreferences: true } }),
    readWhatsappState(),
  ]);

  // Read once here rather than threaded through every page that renders a
  // task: the reminder picker is the only consumer, and it only needs them
  // to say out loud what "default" means.
  const reminderDefaults = {
    hour: user.reminderHour,
    lead: envNumber(process.env.WHATSAPP_REMINDER_LEAD, 15),
  };

  return (
    <div data-app-shell className="flex h-dvh overflow-hidden bg-paper max-md:flex-col">
      <Sidebar data={sidebar} user={user} onLogout={logoutAction} />
      {/* Only this column scrolls — the sidebar stays put. */}
      <main className="view-surface scroll-quiet min-w-0 flex-1 overflow-y-auto">
        <WorkspaceBar projects={sidebar.projects} />
        {/* A single reading column. Hebrew runs shorter than English for the
            same content, so 44rem keeps the line length comfortable.
            A page that is a grid rather than prose — the calendar — opts out by
            marking its root `data-wide`. */}
        <div className="workspace-content mx-auto w-full max-w-[50rem] px-4 has-[[data-wide]]:max-w-[82rem] md:px-8">
          <ComposerPreferencesProvider value={readComposerPreferences(whatsappUser.composerPreferences)}>
            <ReminderDefaultsProvider value={reminderDefaults}>{children}</ReminderDefaultsProvider>
          </ComposerPreferencesProvider>
        </div>
        {/* The tab bar is fixed, so the column owes it a floor to scroll to.
            Without this the last task sits under the bar and cannot be read,
            which is the classic bottom-navigation bug. */}
        <div aria-hidden className="h-[var(--tab-bar)]" />
      </main>
      <ViewTransitions />
      <TabBar counts={sidebar.counts} />
      <CommandPalette projects={sidebar.projects} labels={sidebar.labels} />
      <WhatsappIntroduction userId={user.id} eligible={shouldIntroduceWhatsapp(whatsappUser)} available={whatsappState.status === 'READY' && !whatsappState.stale} />
    </div>
  );
}
