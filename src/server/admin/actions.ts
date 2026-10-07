'use server';

import { db } from '@/server/db';
import { requireAdministrator } from './access';
import { requestPasswordReset } from '@/server/auth/reset';

export type AdminResetState = {
  status: 'sent' | 'preview' | 'rate_limited' | 'error';
  message: string;
  retryAfterSeconds?: number;
};

/** The administrator issues a link; the recipient alone chooses a new password. */
export async function sendUserPasswordResetAction(userId: string): Promise<AdminResetState> {
  const { user: administrator } = await requireAdministrator();
  if (typeof userId !== 'string' || !userId || userId.length > 64) return { status: 'error', message: 'המשתמש לא נמצא' };
  const target = await db.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!target || target.role !== 'user') return { status: 'error', message: 'המשתמש לא נמצא' };

  const outcome = await requestPasswordReset(target.email);
  console.info(JSON.stringify({ event: 'admin.password_reset.requested', administratorId: administrator.id, userId, status: outcome.status }));
  if (outcome.status === 'sent') return { status: 'sent', message: 'קישור נשלח לאימייל', retryAfterSeconds: 60 };
  if (outcome.status === 'preview') return { status: 'preview', message: 'נוצרה תצוגת בדיקה. מייל לא נשלח', retryAfterSeconds: 60 };
  if (outcome.status === 'rate_limited') return { status: 'rate_limited', message: outcome.retryAfterSeconds <= 60 ? 'כבר נשלח קישור. אפשר לנסות בעוד דקה' : 'יש קישורים בתוקף. אפשר לנסות מאוחר יותר', retryAfterSeconds: outcome.retryAfterSeconds };
  return { status: 'error', message: outcome.status === 'not_found' ? 'המשתמש לא נמצא' : 'המייל לא נשלח. אפשר לנסות שוב' };
}
