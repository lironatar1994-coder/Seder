import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/server/db';

/**
 * Accepting an invitation, as a plain function rather than a Server Action.
 *
 * The join page does this while rendering, and a `'use server'` action is not
 * callable from a render — `revalidatePath` inside one throws there. Redirecting
 * to the project is enough on its own: that route is dynamic, so it is built
 * fresh with the new membership already in place.
 */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type AcceptResult = { projectId: string } | { error: string };

export async function acceptInvite(userId: string, token: string): Promise<AcceptResult> {
  return db.$transaction(async (tx) => {
  const invite = await tx.projectInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: { projectId: true, expiresAt: true, email: true, project: { select: { userId: true, archivedAt: true } } },
  });

  if (!invite || invite.expiresAt.getTime() <= Date.now() || invite.project.archivedAt) {
    return { error: 'ההזמנה כבר לא בתוקף. אפשר לבקש קישור חדש ממי ששיתף.' };
  }

  // Already in, one way or another. Links get clicked twice, and the second
  // click should land you in the project rather than on an error.
  if (invite.email) {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email.toLowerCase() !== invite.email.toLowerCase()) return { error: 'ההזמנה מיועדת לכתובת אימייל אחרת. יש להיכנס לחשבון שאליו נשלחה ההזמנה.' };
  }
  if (invite.project.userId === userId) return { projectId: invite.projectId };
  if (await tx.projectMember.findUnique({ where: { projectId_userId: { projectId: invite.projectId, userId } } })) return { projectId: invite.projectId };
  if (await tx.projectMember.count({ where: { projectId: invite.projectId } }) >= 20) return { error: 'הפרויקט הגיע למגבלה של 20 משתתפים.' };

  await tx.projectMember.upsert({ where: { projectId_userId: { projectId: invite.projectId, userId } }, create: { projectId: invite.projectId, userId }, update: {} });

  /* The invitation is not consumed. It is a link the owner may have sent to
     several people — a family, a team — and burning it on the first acceptance
     would make the second person's copy mysteriously dead. It expires on its
     own, and the owner can revoke it. */
  return { projectId: invite.projectId };
  });
}
