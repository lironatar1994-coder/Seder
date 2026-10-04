'use server';

import { z } from 'zod';
import { db } from '@/server/db';
import { requireUser } from '@/server/auth/session';
import { canUseTask } from '@/server/access';

export async function getCommentsAction(taskId: string) {
  const user = await requireUser();
  if (!(await canUseTask(user.id, taskId))) return { ok: false as const, error: 'המשימה לא נמצאה' };
  const comments = await db.taskComment.findMany({ where: { taskId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 200, select: { id: true, body: true, createdAt: true, user: { select: { id: true, name: true } } } });
  return { ok: true as const, comments: comments.map((comment) => ({ ...comment, canDelete: comment.user.id === user.id })) };
}

export async function addCommentAction(taskId: string, body: string) {
  const user = await requireUser();
  const parsed = z.string().trim().min(1).max(4000).safeParse(body);
  if (!parsed.success) return { ok: false, error: 'אפשר לכתוב תגובה באורך של עד 4,000 תווים' };
  if (!(await canUseTask(user.id, taskId))) return { ok: false, error: 'המשימה לא נמצאה' };
  if (await db.taskComment.count({ where: { taskId } }) >= 200) return { ok: false, error: 'המשימה הגיעה למגבלה של 200 תגובות' };
  await db.taskComment.create({ data: { taskId, userId: user.id, body: parsed.data } });
  return { ok: true };
}

export async function deleteCommentAction(commentId: string) {
  const user = await requireUser();
  const comment = await db.taskComment.findFirst({ where: { id: commentId, userId: user.id }, select: { taskId: true } });
  if (!comment || !(await canUseTask(user.id, comment.taskId))) return { ok: false, error: 'התגובה לא נמצאה' };
  await db.taskComment.deleteMany({ where: { id: commentId, userId: user.id } });
  return { ok: true };
}
