import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { visibleTasks } from '@/server/access';
import { addDays, today } from '@/lib/dates';
import { taskSelect, toDTO } from './queries';
import type { TaskFilter } from '@/lib/task-filters';

export async function getFilteredTasks(userId: string, filter: TaskFilter) {
  const base = today();
  const access = await visibleTasks(userId);
  const constraints: Prisma.TaskWhereInput[] = [];
  if (filter.priority !== 'all') constraints.push({ priority: Number(filter.priority) });
  if (filter.projectId) constraints.push({ projectId: filter.projectId });
  if (filter.query) constraints.push({ OR: [{ title: { contains: filter.query } }, { notes: { contains: filter.query } }] });
  if (filter.when === 'overdue') constraints.push({ OR: [{ scheduledFor: { lt: base } }, { deadline: { lt: base } }] });
  if (filter.when === 'today') constraints.push({ OR: [{ scheduledFor: { lte: base } }, { deadline: { lte: base } }] });
  if (filter.when === 'week') constraints.push({ OR: [{ scheduledFor: { gte: base, lt: addDays(base, 7) } }, { deadline: { gte: base, lt: addDays(base, 7) } }] });
  if (filter.when === 'undated') constraints.push({ scheduledFor: null });
  if (filter.assignee === 'me') constraints.push({ assigneeId: userId });
  if (filter.assignee === 'unassigned') constraints.push({ assigneeId: null });
  if (filter.scope === 'shared') constraints.push({ project: { OR: [{ members: { some: {} } }, { userId: { not: userId } }] } });
  const where: Prisma.TaskWhereInput = { AND: [access, ...constraints], status: 'TODO', parentId: null };
  const [rows, count] = await Promise.all([
    db.task.findMany({ where, select: taskSelect(userId), orderBy: [{ priority: 'asc' }, { position: 'asc' }], take: 500 }),
    db.task.count({ where }),
  ]);
  return { tasks: rows.map(toDTO), count };
}
