import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { requireAdministrator } from './access';
import { normalizeAdminQuery } from '@/lib/admin-metrics';

const PAGE_SIZE = 25;

/** Search reads only the user list, with the same live role check as the page. */
export async function getAdminUsers(query: { q?: string; page?: string } = {}) {
  await requireAdministrator();
  const { search, page: requestedPage } = normalizeAdminQuery(query.q, query.page);
  const where: Prisma.UserWhereInput = {
    role: 'user',
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
  };
  const filteredCount = await db.user.count({ where });
  const pages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const users = await db.user.findMany({
    where, orderBy: [{ lastActiveAt: 'desc' }, { createdAt: 'desc' }], take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE,
    select: {
      id: true, name: true, email: true, createdAt: true, lastActiveAt: true,
      whatsappCapture: true, whatsappReminders: true, phone: true,
      googleCalendar: { select: { lastError: true } },
      _count: { select: { projects: true } },
    },
  });
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
    now: new Date(), search, page, pages, filteredCount,
    // Passwords, tokens, task text, phone numbers and raw errors stay on the server.
    users: users.map((user) => ({
      id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, lastActiveAt: user.lastActiveAt,
      projects: user._count.projects, ...(counts.get(user.id) ?? { open: 0, completed: 0 }),
      whatsapp: Boolean(user.phone && (user.whatsappCapture || user.whatsappReminders)),
      google: Boolean(user.googleCalendar), googleError: Boolean(user.googleCalendar?.lastError),
    })),
  };
}

export type AdminUsersData = Awaited<ReturnType<typeof getAdminUsers>>;
