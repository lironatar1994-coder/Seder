import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '@/server/db';
import { sendMail, appUrl, emailHtml } from '@/server/mail';

/** An hour is long enough to find the mail and short enough to limit exposure
 *  if the inbox is later compromised. */
export const RESET_TTL_MS = 1000 * 60 * 60;

/** At most this many live tokens per account, so requesting repeatedly cannot
 *  be used to flood an inbox or to widen the guessing surface. */
const MAX_LIVE_TOKENS = 3;

export type PasswordResetOutcome =
  | { status: 'sent' | 'preview' | 'failed' | 'not_found' }
  | { status: 'rate_limited'; retryAfterSeconds: number };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a reset link, if the address belongs to an account.
 *
 * The public caller must ignore the outcome and show one generic response.
 * Only the authenticated administrator may report delivery errors or throttling.
 * No caller receives the raw token or reset URL.
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetOutcome> {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return { status: 'not_found' };

  const token = randomBytes(32).toString('base64url');
  const issued = await db.$transaction(async (tx) => {
    const now = new Date();
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, expiresAt: { lte: now } } });
    const live = await tx.passwordResetToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, expiresAt: true } });
    if (live[0] && live[0].createdAt.getTime() > now.getTime() - 60_000) {
      return { retryAfterSeconds: Math.max(1, Math.ceil((live[0].createdAt.getTime() + 60_000 - now.getTime()) / 1000)) };
    }
    if (live.length >= MAX_LIVE_TOKENS) {
      return { retryAfterSeconds: Math.max(1, Math.ceil((Math.min(...live.map((row) => row.expiresAt.getTime())) - now.getTime()) / 1000)) };
    }
    return tx.passwordResetToken.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(now.getTime() + RESET_TTL_MS) }, select: { id: true } });
  });
  if ('retryAfterSeconds' in issued) return { status: 'rate_limited', retryAfterSeconds: issued.retryAfterSeconds };

  const link = `${appUrl()}/reset/${token}`;

  try { const delivery = await sendMail({
    to: email,
    subject: 'איפוס סיסמה · סדר',
    html: emailHtml('איפוס הסיסמה', `שלום ${user.name}, הקישור לאיפוס הסיסמה תקף לשעה אחת וניתן לשימוש פעם אחת.`, link, 'בחירת סיסמה חדשה'),
    text: [
      `שלום ${user.name},`,
      '',
      'קיבלנו בקשה לאיפוס הסיסמה בחשבון שלכם. הקישור תקף לשעה אחת וניתן לשימוש פעם אחת:',
      '',
      link,
      '',
      'אם לא ביקשתם לאפס סיסמה, אפשר להתעלם מההודעה. הסיסמה הנוכחית תישאר בתוקף.',
      '',
      'סדר',
    ].join('\n'),
  });
    return { status: delivery.delivered ? 'sent' : 'preview' };
  } catch {
    await db.passwordResetToken.deleteMany({ where: { id: issued.id } });
    console.error('[Seder] Password recovery delivery failed; token removed.');
    return { status: 'failed' };
  }
}

export interface ResetTarget {
  tokenId: string;
  userId: string;
}

/** Resolves a raw token to its account, or null if it is unknown or expired. */
export async function findResetTarget(token: string): Promise<ResetTarget | null> {
  if (!token) return null;

  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.passwordResetToken.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }

  return { tokenId: row.id, userId: row.userId };
}

/**
 * Applies the new password.
 *
 * Everything is done in one transaction, and every existing session is dropped:
 * if the reset was triggered because someone else had access, leaving their
 * session alive would defeat the point.
 */
export async function completePasswordReset(
  target: ResetTarget,
  passwordHash: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.deleteMany({ where: { id: target.tokenId, userId: target.userId, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new Error('RESET_EXPIRED');
    await tx.user.update({
      where: { id: target.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    await tx.session.deleteMany({ where: { userId: target.userId } });
    // Burn every outstanding token, not just the one used.
    await tx.passwordResetToken.deleteMany({ where: { userId: target.userId } });
  });
}
