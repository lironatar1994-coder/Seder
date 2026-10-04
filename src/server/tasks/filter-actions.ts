'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/server/db';
import { requireUser } from '@/server/auth/session';
import { taskFilterSchema } from '@/lib/task-filters';
import { canUseProject } from '@/server/access';

export async function saveFilterAction(name: string, config: unknown) {
  const user = await requireUser();
  const parsedName = z.string().trim().min(1).max(60).safeParse(name);
  const parsed = taskFilterSchema.safeParse(config);
  if (!parsedName.success || !parsed.success) return { ok: false, error: 'צריך שם קצר ומסנן תקין' };
  if (parsed.data.projectId && !(await canUseProject(user.id, parsed.data.projectId))) return { ok: false, error: 'הפרויקט לא נמצא' };
  if (await db.savedFilter.count({ where: { userId: user.id } }) >= 20) return { ok: false, error: 'אפשר לשמור עד 20 מסננים' };
  const filter = await db.savedFilter.create({ data: { userId: user.id, name: parsedName.data, config: JSON.stringify(parsed.data) } });
  revalidatePath('/app', 'layout');
  return { ok: true, id: filter.id };
}
export async function deleteFilterAction(id: string) {
  const user = await requireUser();
  await db.savedFilter.deleteMany({ where: { id, userId: user.id } });
  revalidatePath('/app', 'layout');
  return { ok: true };
}
