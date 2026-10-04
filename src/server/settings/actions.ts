'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { requireSession, destroyCurrentSession } from '@/server/auth/session';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { nameSchema, passwordSchema, viewSlugSchema } from '@/lib/validation';
import { composerPreferencesSchema } from '@/lib/composer-preferences';

export interface SettingsState {
  errors?: Record<string, string>;
  /** Shown next to the control that was just saved. */
  saved?: boolean;
}

function refresh() {
  revalidatePath('/app', 'layout');
}

export async function updateNameAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { user } = await requireSession();
  const parsed = nameSchema.safeParse(String(formData.get('name') ?? ''));

  if (!parsed.success) {
    return { errors: { name: parsed.error.issues[0].message } };
  }

  await db.user.update({ where: { id: user.id }, data: { name: parsed.data } });
  refresh();
  return { saved: true };
}

export async function updateDefaultViewAction(slug: string): Promise<SettingsState> {
  const { user } = await requireSession();
  const parsed = viewSlugSchema.safeParse(slug);
  if (!parsed.success) return { errors: { defaultView: 'תצוגה לא מוכרת' } };

  await db.user.update({ where: { id: user.id }, data: { defaultView: parsed.data } });
  refresh();
  return { saved: true };
}

export async function updateComposerPreferencesAction(value: unknown): Promise<SettingsState> {
  const { user } = await requireSession();
  const parsed = composerPreferencesSchema.safeParse(value);
  if (!parsed.success) return { errors: { composer: 'הבחירה לא תקינה. נסו לבחור שוב.' } };
  await db.user.update({ where: { id: user.id }, data: { composerPreferences: JSON.stringify(parsed.data) } });
  refresh();
  return { saved: true };
}

/**
 * Changes the password from inside the app.
 *
 * The current password is required — a signed-in session left open on someone
 * else's machine should not be enough to lock the owner out. Every *other*
 * session is dropped; this one stays, because signing the user out of the page
 * they are typing on is a bug, not a security measure.
 */
export async function changePasswordAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { user, sessionId } = await requireSession();

  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) return { errors: { next: parsed.error.issues[0].message } };
  if (next !== confirm) return { errors: { confirm: 'שתי הסיסמאות לא זהות' } };

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) return { errors: { _: 'המשתמש לא נמצא' } };

  if (!(await verifyPassword(row.passwordHash, current))) {
    return { errors: { current: 'הסיסמה הנוכחית לא נכונה' } };
  }

  if (await verifyPassword(row.passwordHash, next)) {
    return { errors: { next: 'הסיסמה החדשה זהה לנוכחית' } };
  }

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data) },
    }),
    db.session.deleteMany({ where: { userId: user.id, NOT: { id: sessionId } } }),
    db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  ]);

  refresh();
  return { saved: true };
}

export async function signOutOtherSessionsAction(): Promise<SettingsState> {
  const { user, sessionId } = await requireSession();
  await db.session.deleteMany({ where: { userId: user.id, NOT: { id: sessionId } } });
  refresh();
  return { saved: true };
}

/** How many devices are signed in besides this one. */
export async function otherSessionCount(): Promise<number> {
  const { user, sessionId } = await requireSession();
  return db.session.count({
    where: { userId: user.id, NOT: { id: sessionId }, expiresAt: { gt: new Date() } },
  });
}

/**
 * Deletes the account and everything in it.
 *
 * Guarded by the password rather than by a checkbox: this is the one action in
 * the app that cannot be undone.
 */
export async function deleteAccountAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { user } = await requireSession();
  const password = String(formData.get('password') ?? '');

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) return { errors: { _: 'המשתמש לא נמצא' } };

  if (!(await verifyPassword(row.passwordHash, password))) {
    return { errors: { password: 'הסיסמה לא נכונה' } };
  }

  // Every relation cascades from User, so this takes the projects, tasks,
  // labels, sessions and reset tokens with it.
  await db.$transaction(async (tx) => {
    // A member's account deletion must preserve the team's work.
    const joinedProjects = await tx.project.findMany({ where: { userId: { not: user.id }, tasks: { some: { userId: user.id } } }, select: { id: true, userId: true } });
    for (const project of joinedProjects) await tx.task.updateMany({ where: { userId: user.id, projectId: project.id }, data: { userId: project.userId } });
    await tx.user.delete({ where: { id: user.id } });
  });
  await destroyCurrentSession();

  redirect('/?deleted=1');
}
