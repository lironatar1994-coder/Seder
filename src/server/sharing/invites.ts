import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/server/db';
import { canUseProject } from '@/server/access';

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
  const invite = await db.projectInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: { projectId: true, expiresAt: true },
  });

  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    return { error: 'ההזמנה כבר לא בתוקף. אפשר לבקש קישור חדש ממי ששיתף.' };
  }

  // Already in, one way or another. Links get clicked twice, and the second
  // click should land you in the project rather than on an error.
  if (await canUseProject(userId, invite.projectId)) return { projectId: invite.projectId };

  await db.projectMember.create({ data: { projectId: invite.projectId, userId } });

  /* The invitation is not consumed. It is a link the owner may have sent to
     several people — a family, a team — and burning it on the first acceptance
     would make the second person's copy mysteriously dead. It expires on its
     own, and the owner can revoke it. */
  return { projectId: invite.projectId };
}
