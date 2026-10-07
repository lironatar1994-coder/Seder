import 'server-only';
import { db } from '@/server/db';
import { requireAdministrator } from './access';
import { buildActivityDays, type ActivityHour } from '@/lib/admin-metrics';
import { readWhatsappState } from '@/server/whatsapp/status';
import { googleConfigured } from '@/server/google/client';
import { getAdminUsers } from './users';

export async function getAdminOverview(query: { q?: string; page?: string } = {}) {
  const session = await requireAdministrator();
  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * 86_400_000);
  const since24 = new Date(now.getTime() - 86_400_000);
  // One extra day is fetched, then removed by Jerusalem calendar bucketing.
  const since15 = now.getTime() - 15 * 86_400_000;
  const [listing, usersTotal, usersActive, usersNew, tasksOpen, tasksCreated, tasksCompleted, hours, whatsapp, waEnabled, waSent, waFailed, googleCount, googleErrors] = await Promise.all([
    getAdminUsers(query),
    db.user.count({ where: { role: 'user' } }),
    db.user.count({ where: { role: 'user', lastActiveAt: { gte: since7 } } }),
    db.user.count({ where: { role: 'user', createdAt: { gte: since7 } } }),
    db.task.count({ where: { user: { role: 'user' }, status: 'TODO' } }),
    db.task.count({ where: { user: { role: 'user' }, createdAt: { gte: since7 } } }),
    db.task.count({ where: { user: { role: 'user' }, status: 'DONE', completedAt: { gte: since7 } } }),
    db.$queryRaw<ActivityHour[]>`
      SELECT 'created' AS kind, CAST(t.createdAt / 3600000 AS INTEGER) AS hour, COUNT(*) AS count
      FROM Task t JOIN User u ON u.id = t.userId
      WHERE u.role = 'user' AND t.createdAt >= ${since15}
      GROUP BY hour
      UNION ALL
      SELECT 'completed' AS kind, CAST(t.completedAt / 3600000 AS INTEGER) AS hour, COUNT(*) AS count
      FROM Task t JOIN User u ON u.id = t.userId
      WHERE u.role = 'user' AND t.status = 'DONE' AND t.completedAt >= ${since15}
      GROUP BY hour`,
    readWhatsappState(),
    db.user.count({ where: { role: 'user', phone: { not: null }, OR: [{ whatsappCapture: true }, { whatsappReminders: true }] } }),
    db.whatsappLog.count({ where: { direction: 'OUT', status: 'sent', createdAt: { gte: since24 } } }),
    db.whatsappLog.count({ where: { direction: 'OUT', status: 'failed', createdAt: { gte: since24 } } }),
    db.googleCalendarConnection.count({ where: { user: { role: 'user' } } }),
    db.googleCalendarConnection.count({ where: { user: { role: 'user' }, lastError: { not: null } } }),
  ]);

  return {
    ...listing, now, admin: { email: session.user.email },
    totals: { users: usersTotal, active: usersActive, newUsers: usersNew, open: tasksOpen, created: tasksCreated, completed: tasksCompleted },
    days: buildActivityDays(hours, now),
    services: {
      whatsapp: { status: whatsapp.status, stale: whatsapp.stale, qr: whatsapp.stale ? null : whatsapp.qr, enabled: waEnabled, sent: waSent, failed: waFailed },
      google: { configured: googleConfigured(), connected: googleCount, errors: googleErrors },
      mail: { configured: Boolean(process.env.SMTP_URL || process.env.RESEND_API_KEY) && process.env.MAIL_PREVIEW !== '1' },
    },
  };
}

export type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;
