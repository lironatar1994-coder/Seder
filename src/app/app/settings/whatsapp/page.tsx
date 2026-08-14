import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { getCurrentUser } from '@/server/auth/session';
import { readWhatsappState } from '@/server/whatsapp/status';
import { readWhatsappHealth } from '@/server/whatsapp/health';
import { WhatsappForm } from '@/components/settings/whatsapp-form';
import { WhatsappHealthPanel } from '@/components/settings/whatsapp-health';

/** The connection is one paired number for the whole app, so pairing it is an
 *  operator job rather than a per-account one. Unset in development, which
 *  means the code is shown to nobody until someone is named. */
function isAdmin(email: string): boolean {
  const admin = process.env.SEDER_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(admin) && email.trim().toLowerCase() === admin;
}

const TIME = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
});

export default async function WhatsappSettingsPage() {
  const user = await getCurrentUser();
  if (!user) notFound();

  const operator = isAdmin(user.email);

  const [row, state, recent] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { phone: true, whatsappCapture: true, whatsappReminders: true, reminderHour: true },
    }),
    readWhatsappState(),
    db.whatsappLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, body: true, direction: true, status: true, createdAt: true },
    }),
  ]);

  // Only queried for the operator: it reads across every account, and a page
  // that runs the query and then hides the result has still run the query.
  const health = operator ? await readWhatsappHealth() : null;

  return (
    <>
      <WhatsappForm
        phone={row?.phone ?? null}
        capture={row?.whatsappCapture ?? false}
        reminders={row?.whatsappReminders ?? false}
        reminderHour={row?.reminderHour ?? 8}
        state={state}
        isAdmin={operator}
        recent={recent.map((log) => ({
          ...log,
          createdAt: TIME.format(log.createdAt),
        }))}
      />
      {health && <WhatsappHealthPanel health={health} />}
    </>
  );
}
