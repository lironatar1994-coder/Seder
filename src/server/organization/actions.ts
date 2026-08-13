'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { canUseProject } from '@/server/access';
import { requireUser } from '@/server/auth/session';
import { projectSchema, sectionSchema, labelSchema, fieldErrors } from '@/lib/validation';
import { keyAfterLast, keyBetween } from '@/lib/ordering';
import type { ActionResult } from '@/server/tasks/actions';

function refresh() {
  revalidatePath('/app', 'layout');
}

export async function createProjectAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] };
  }

  const siblings = await db.project.findMany({
    where: { userId: user.id },
    select: { position: true },
    orderBy: { position: 'asc' },
  });

  const project = await db.project.create({
    data: { ...parsed.data, userId: user.id, position: keyAfterLast(siblings) },
    select: { id: true },
  });

  refresh();
  return { ok: true, id: project.id };
}

export async function renameProjectAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] };
  }

  /* Owner only, here and for deletion. Everyone in a shared project can work
     the list — add, edit, complete, file — but renaming or deleting it changes
     the thing itself for everybody, so it stays with whoever made it. */
  const result = await db.project.updateMany({
    where: { id, userId: user.id },
    data: parsed.data,
  });
  if (result.count === 0) return { ok: false, error: 'הפרויקט לא נמצא' };

  refresh();
  return { ok: true };
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!project) return { ok: false, error: 'הפרויקט לא נמצא' };

  // Cascade removes the project's tasks with it — the confirm dialog says so.
  await db.project.delete({ where: { id } });
  refresh();
  redirect('/app/today');
}

export async function createSectionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] };
  }

  if (!(await canUseProject(user.id, parsed.data.projectId))) {
    return { ok: false, error: 'הפרויקט לא נמצא' };
  }

  const siblings = await db.section.findMany({
    where: { projectId: parsed.data.projectId },
    select: { position: true },
    orderBy: { position: 'asc' },
  });

  const section = await db.section.create({
    data: { ...parsed.data, position: keyAfterLast(siblings) },
    select: { id: true },
  });

  refresh();
  return { ok: true, id: section.id };
}

export async function deleteSectionAction(id: string): Promise<ActionResult> {
  const user = await requireUser();

  /* A heading is part of working the list, not a setting, so anyone in the
     project may add or remove one. */
  const section = await db.section.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!section || !(await canUseProject(user.id, section.projectId))) {
    return { ok: false, error: 'הקטע לא נמצא' };
  }

  // onDelete: SetNull on the relation means the tasks survive and fall back to
  // the project's loose list. Deleting a heading must not delete work.
  await db.section.delete({ where: { id } });
  refresh();
  return { ok: true };
}

export async function createLabelAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = labelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] };
  }

  const siblings = await db.label.findMany({
    where: { userId: user.id },
    select: { position: true },
    orderBy: { position: 'asc' },
  });

  try {
    const label = await db.label.create({
      data: { ...parsed.data, userId: user.id, position: keyAfterLast(siblings) },
      select: { id: true },
    });
    refresh();
    return { ok: true, id: label.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'כבר יש תווית בשם הזה' };
    }
    throw error;
  }
}

export async function deleteLabelAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const result = await db.label.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return { ok: false, error: 'התווית לא נמצאה' };
  refresh();
  return { ok: true };
}

export async function reorderProjectAction(
  id: string,
  beforeId: string | null,
  afterId: string | null,
): Promise<ActionResult> {
  const user = await requireUser();
  const owned = await db.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: 'הפרויקט לא נמצא' };

  const [before, after] = await Promise.all([
    beforeId
      ? db.project.findFirst({
          where: { id: beforeId, userId: user.id },
          select: { position: true },
        })
      : null,
    afterId
      ? db.project.findFirst({
          where: { id: afterId, userId: user.id },
          select: { position: true },
        })
      : null,
  ]);

  await db.project.update({
    where: { id },
    data: { position: keyBetween(before?.position ?? null, after?.position ?? null) },
  });

  refresh();
  return { ok: true };
}
