import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { requireAdministrator } from './access';
import { buildActivityDays, normalizeAdminQuery, type ActivityHour } from '@/lib/admin-metrics';
import { readWhatsappState } from '@/server/whatsapp/status';
import { googleConfigured } from '@/server/google/client';

export const ADMIN_PAGE_SIZE = 25;

export async function getAdminOverview(query: { q?: string; page?: string } = {}) {
  const session = await requireAdministrator();
  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * 86_400_000);
  const since24 = new Date(now.getTime() - 86_400_000);
  // One extra day is fetched, then removed by Jerusalem calendar bucketing.
  const since15 = now.getTime() - 15 * 86_400_000;
  const { search, page: requestedPage } = normalizeAdminQuery(query.q, query.page);
  const where: Prisma.UserWhereInput = {
    role: 'user',
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
  };
  const filteredCount = await db.user.count({ where });
  const pages = Math.max(1, Math.ceil(filteredCount / ADMIN_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);

  const [users, usersTotal, usersActive, usersNew, tasksOpen, tasksCreated, tasksCompleted, hours, whatsapp, waEnabled, waSent, waFailed, googleCount, googleErrors] = await Promise.all([
    db.user.findMany({
      where, orderBy: [{ lastActiveAt: 'desc' }, { createdAt: 'desc' }], take: ADMIN_PAGE_SIZE, skip: (page - 1) * ADMIN_PAGE_SIZE,
      select: {
        id: true, name: true, email: true, createdAt: true, lastActiveAt: true,
        whatsappCapture: true, whatsappReminders: true, phone: true,
        googleCalendar: { select: { lastSyncAt: true, lastError: true } },
        _count: { select: { projects: true } },
      },
    }),
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

  const taskGroups = users.length ? await db.task.groupBy({
    by: ['userId', 'status'], where: { userId: { in: users.map((user) => user.id) } }, _count: { _all: true },
  }) : [];
  const counts = new Map<string, { open: number; completed: number }>();
  for (const group of taskGroups) {
    const count = counts.get(group.userId) ?? { open: 0, completed: 0 };
    if (group.status === 'TODO') count.open += group._count._all;
    if (group.status === 'DONE') count.completed += group._count._all;
    counts.set(group.userId, count);
  }

  return {
    now, admin: { email: session.user.email }, search, page, pages, filteredCount,
    totals: { users: usersTotal, active: usersActive, newUsers: usersNew, open: tasksOpen, created: tasksCreated, completed: tasksCompleted },
    days: buildActivityDays(hours, now),
    // Never return passwords, tokens, task text, phone numbers, or raw errors.
    users: users.map((user) => ({
      id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, lastActiveAt: user.lastActiveAt,
      projects: user._count.projects, ...(counts.get(user.id) ?? { open: 0, completed: 0 }),
      whatsapp: Boolean(user.phone && (user.whatsappCapture || user.whatsappReminders)),
      google: Boolean(user.googleCalendar), googleError: Boolean(user.googleCalendar?.lastError),
    })),
    services: {
      whatsapp: { status: whatsapp.status, stale: whatsapp.stale, qr: whatsapp.stale ? null : whatsapp.qr, enabled: waEnabled, sent: waSent, failed: waFailed },
      google: { configured: googleConfigured(), connected: googleCount, errors: googleErrors },
      mail: { configured: Boolean(process.env.SMTP_URL || process.env.RESEND_API_KEY) && process.env.MAIL_PREVIEW !== '1' },
    },
  };
}

export type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;
