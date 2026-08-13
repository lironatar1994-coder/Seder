import 'server-only';
import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Who may see and touch what, once projects can be shared.
 *
 * Before sharing, every query said `where: { userId }` and that was the whole
 * authorisation model — correct, and repeated at fifty-five call sites. Adding
 * a second way to reach a task would have meant editing all fifty-five and
 * getting every one right; the first one missed is a task leaking between
 * accounts. So the rule is stated once, here, and the call sites ask for it.
 *
 * The rule:
 *
 *   - A **project** is yours if you own it or you have been let in.
 *   - A **task** is yours if it sits in a project you can reach, or if it has
 *     no project at all and you wrote it. The second half is what keeps the
 *     Inbox private: an unfiled task has no project to inherit access from, so
 *     nobody else can ever see it.
 *   - **Labels** are never shared, even on a task two people can both see.
 *
 * Nothing outside a project is shareable, which is the point: sharing is a
 * property of a project and of nothing else.
 */

/**
 * Every project this user can reach, owned or joined.
 *
 * `cache()` scopes memoisation to the request, the same way `validateSession`
 * does — a page renders the sidebar, a view and a count, and all three ask.
 */
export const accessibleProjectIds = cache(async (userId: string): Promise<string[]> => {
  const rows = await db.project.findMany({
    where: { OR: [{ userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  return rows.map((row) => row.id);
});

/**
 * Tasks this user is allowed to see.
 *
 * Returned wrapped in `AND` rather than as a bare `OR`, so it is safe to spread
 * into a `where` that has an `OR` of its own — and several do. A bare `OR` here
 * would be overwritten by the caller's, and the failure mode of that mistake is
 * a query with no access predicate at all.
 */
export async function visibleTasks(userId: string): Promise<Prisma.TaskWhereInput> {
  const projectIds = await accessibleProjectIds(userId);
  return {
    AND: [
      {
        OR: [
          // Unfiled and mine — the Inbox, which no amount of sharing reaches.
          { userId, projectId: null },
          { projectId: { in: projectIds } },
        ],
      },
    ],
  };
}

/**
 * Tasks that belong on *this* user's plate.
 *
 * The visible set minus work that is explicitly someone else's. A shared task
 * nobody has claimed still counts as mine to do — it shows in the project for
 * everyone and in Today for everyone, which is what makes "who is taking this?"
 * a visible question rather than a silent gap.
 */
export async function myWork(userId: string): Promise<Prisma.TaskWhereInput> {
  const { AND } = await visibleTasks(userId);
  return {
    AND: [
      ...(AND as Prisma.TaskWhereInput[]),
      { OR: [{ assigneeId: null }, { assigneeId: userId }] },
    ],
  };
}

export type ProjectRole = 'owner' | 'member';

/** The user's standing in a project, or null if they cannot reach it. */
export async function projectRole(
  userId: string,
  projectId: string,
): Promise<ProjectRole | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { userId: true, members: { where: { userId }, select: { id: true } } },
  });
  if (!project) return null;
  if (project.userId === userId) return 'owner';
  return project.members.length > 0 ? 'member' : null;
}

/** True if the user may read and write inside the project. */
export async function canUseProject(userId: string, projectId: string): Promise<boolean> {
  return (await projectRole(userId, projectId)) !== null;
}

/**
 * True if the user may act on this task.
 *
 * Deliberately the same answer for reading and writing. A shared project where
 * you can see a task but not tick it off is not collaboration, and every app
 * that has tried the halfway version — view-only members — ends up with people
 * asking someone else to press the button.
 */
export async function canUseTask(userId: string, taskId: string): Promise<boolean> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { userId: true, projectId: true },
  });
  if (!task) return false;
  if (task.projectId === null) return task.userId === userId;
  return canUseProject(userId, task.projectId);
}

/**
 * The people a task in this project can be handed to: the owner and everyone
 * let in. Returned even for an unshared project, where it is just the owner —
 * the caller then knows there is nobody to assign to and can leave the control
 * out rather than offering a menu of one.
 */
export interface Collaborator {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
}

export async function projectCollaborators(projectId: string): Promise<Collaborator[]> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      user: { select: { id: true, name: true, email: true } },
      members: {
        select: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!project) return [];

  return [
    { ...project.user, isOwner: true },
    ...project.members.map((m) => ({ ...m.user, isOwner: false })),
  ];
}

/**
 * Labels belong to the person who made them and are never shared, so a task in
 * a shared project shows each viewer only their own. Without this, opening a
 * shared task would show a colleague's private filing system — and worse, the
 * label chips would differ per viewer with no explanation.
 */
export function labelsFor(userId: string) {
  return {
    where: { label: { userId } },
    select: { label: { select: { id: true, name: true, color: true } } },
  } as const;
}
