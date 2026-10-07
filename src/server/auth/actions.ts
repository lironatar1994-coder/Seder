'use server';

import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { hashPassword, verifyPassword } from './password';
import { createSession, destroyCurrentSession } from './session';
import {
  registerSchema,
  loginSchema,
  emailSchema,
  passwordSchema,
  fieldErrors,
} from '@/lib/validation';
import {
  requestPasswordReset,
  findResetTarget,
  completePasswordReset,
} from '@/server/auth/reset';
import { MAX_FAILED_LOGINS, LOGIN_LOCK_MS } from '@/lib/constants';
import { keysBetween } from '@/lib/ordering';
import { accountDestination } from '@/lib/account-role';

export interface AuthFormState {
  errors?: Record<string, string>;
  values?: { name?: string; email?: string };
}

/* One message for "no such account" and for "wrong password". Distinguishing
   them tells an attacker which addresses are registered. */
const BAD_CREDENTIALS = 'האימייל או הסיסמה לא נכונים';

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: { name: raw.name, email: raw.email } };
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    const user = await db.user.create({ data: { name, email, passwordHash, role: 'user' } });
    userId = user.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        errors: { email: 'כבר יש חשבון עם הכתובת הזאת. אפשר להיכנס איתה' },
        values: { name, email },
      };
    }
    throw error;
  }

  await seedStarterContent(userId);
  await createSession(userId);
  redirect(accountDestination({ role: 'user' }, formData.get('next')));
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: { email: raw.email } };
  }

  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    // Spend comparable time on an unknown address so response timing does not
    // reveal whether the account exists.
    await hashPassword(password);
    return { errors: { _: BAD_CREDENTIALS }, values: { email } };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return {
      errors: { _: `יותר מדי ניסיונות. אפשר לנסות שוב בעוד ${minutes} דקות` },
      values: { email },
    };
  }

  const ok = await verifyPassword(user.passwordHash, password);

  if (!ok) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOGIN_LOCK_MS) : null,
      },
    });
    return { errors: { _: BAD_CREDENTIALS }, values: { email } };
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  await createSession(user.id);
  redirect(accountDestination(user, formData.get('next')));
}

export interface ResetFormState {
  errors?: Record<string, string>;
  values?: { email?: string };
  /** Set once the request has been accepted, whatever the address was. */
  sent?: boolean;
}

export async function requestResetAction(
  _prev: ResetFormState,
  formData: FormData,
): Promise<ResetFormState> {
  const raw = String(formData.get('email') ?? '');
  const parsed = emailSchema.safeParse(raw);

  if (!parsed.success) {
    return { errors: { email: parsed.error.issues[0].message }, values: { email: raw } };
  }

  await requestPasswordReset(parsed.data);

  // The same answer for a registered and an unregistered address. Anything else
  // turns this form into a way to check who has an account here.
  return { sent: true, values: { email: parsed.data } };
}

export interface ResetPasswordState {
  errors?: Record<string, string>;
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return { errors: { password: parsed.error.issues[0].message } };
  }
  if (password !== confirm) {
    return { errors: { confirm: 'שתי הסיסמאות לא זהות' } };
  }

  // Re-checked here, not just when the page loaded: the link may have expired
  // or been used while this form sat open.
  const target = await findResetTarget(token);
  if (!target) {
    return { errors: { _: 'הקישור פג או כבר נוצל. אפשר לבקש קישור חדש' } };
  }

  try { await completePasswordReset(target, await hashPassword(parsed.data)); }
  catch (error) {
    if (error instanceof Error && error.message === 'RESET_EXPIRED') return { errors: { _: 'הקישור פג או כבר נוצל. אפשר לבקש קישור חדש' } };
    throw error;
  }
  redirect('/login?reset=1');
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect('/login');
}

/**
 * A brand-new account with six empty views is a dead end. Give it an Inbox, two
 * starter projects and three labels so every view has something to show and the
 * shape of the app is legible immediately.
 */
async function seedStarterContent(userId: string): Promise<void> {
  const [workPos, homePos] = keysBetween(null, null, 2);
  const labelPositions = keysBetween(null, null, 3);

  // No Inbox project: the Inbox is simply "no project", so creating one would
  // give the same idea two homes.
  await db.project.createMany({
    data: [
      { userId, name: 'עבודה', color: 'teal', position: workPos },
      { userId, name: 'בית', color: 'clay', position: homePos },
    ],
  });

  await db.label.createMany({
    data: [
      { userId, name: 'טלפון', color: 'plum', position: labelPositions[0] },
      { userId, name: 'מחשב', color: 'slate', position: labelPositions[1] },
      { userId, name: 'סידורים', color: 'moss', position: labelPositions[2] },
    ],
  });
}
