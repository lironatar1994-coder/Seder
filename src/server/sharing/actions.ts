'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { requireUser } from '@/server/auth/session';
import { projectCollaborators, projectRole } from '@/server/access';
import { sendMail, appUrl, emailHtml } from '@/server/mail';
import { hashInviteToken } from '@/server/sharing/invites';
import { emailSchema } from '@/lib/validation';

/**
 * Sharing a project.
 *
 * The model is Todoist's, because Things has none to copy: sharing lives on a
 * project and goes no further, so the Inbox — which is "no project" — can never
 * be shared, and neither can a personal label.
 *
 * An invitation is a link, not an address. This app may be running with no SMTP
 * configured at all, and a feature that only works when mail is set up is a
 * feature that mostly does not work. The address is optional: give one and the
 * link is mailed as well as shown.
 */

/** A week. Long enough to be answered after a weekend, short enough to expire
 *  before it is forgotten in someone's chat history. */
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/** Enough people to run a household or a small team, few enough that the whole
 *  member list stays legible in one dialog. */
const MAX_MEMBERS = 20;

function refresh() {
  revalidatePath('/app', 'layout');
}

export interface ShareResult {
  ok: boolean;
  error?: string;
  /** The full link, returned so the dialog can show and copy it. */
  link?: string;
  /** Whether it also went out by mail. */
  mailed?: boolean;
  mailError?: string;
}

/**
 * Creates an invitation link for a project.
 *
 * Owner only. A member who could invite could grow a project the owner never
 * agreed to share that widely, and there is no roles UI here to express the
 * difference.
 */
export async function createInviteAction(
  projectId: string,
  email?: string,
): Promise<ShareResult> {
  const user = await requireUser();
  if ((await projectRole(user.id, projectId)) !== 'owner') {
    return { ok: false, error: 'רק מי שיצר את הפרויקט יכול להזמין אליו' };
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { name: true, _count: { select: { members: true } } },
  });
  if (!project) return { ok: false, error: 'הפרויקט לא נמצא' };
  if (project._count.members >= MAX_MEMBERS) {
    return { ok: false, error: `אפשר לשתף עם עד ${MAX_MEMBERS} אנשים` };
  }

  const address = email?.trim().toLowerCase();
  if (address) {
    const parsed = emailSchema.safeParse(address);
    if (!parsed.success) return { ok: false, error: 'כתובת האימייל לא תקינה' };
  }

  // Anything already expired is cleared on the way past, so the table does not
  // accumulate dead rows for a project that gets shared often.
  await db.projectInvite.deleteMany({ where: { projectId, expiresAt: { lt: new Date() } } });
  const pendingInvites = await db.projectInvite.count({ where: { projectId } });
  if (pendingInvites >= 20) return { ok: false, error: 'יש כבר 20 הזמנות פתוחות. אפשר לבטל הזמנות ישנות לפני יצירת הזמנה נוספת.' };

  const token = randomBytes(32).toString('base64url');
  await db.projectInvite.create({
    data: {
      tokenHash: hashInviteToken(token),
      projectId,
      invitedById: user.id,
      email: address || null,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const link = `${appUrl()}/app/join/${token}`;

  let mailed = false;
  let mailError: string | undefined;
  if (address) {
    try { const delivery = await sendMail({
      to: address,
      subject: `${user.name} משתף אתכם ב״${project.name}״ · סדר`,
      html: emailHtml(`הזמנה ל${project.name}`, `${user.name} הזמין אתכם לעבוד יחד. הקישור תקף לשבוע.`, link, 'הצטרפות לפרויקט'),
      text: [
        'שלום,',
        '',
        `${user.name} הזמין אתכם לעבוד יחד על הרשימה ״${project.name}״.`,
        'הקישור תקף לשבוע:',
        '',
        link,
        '',
        'אם ההזמנה לא רלוונטית, אפשר להתעלם מההודעה.',
        '',
        'סדר',
      ].join('\n'),
    }); mailed = delivery.delivered;
      if (!mailed) mailError = 'האימייל לא נשלח. אפשר להעתיק את קישור ההזמנה.';
    } catch { mailError = 'שליחת האימייל נכשלה. אפשר להעתיק את קישור ההזמנה ולנסות שוב מאוחר יותר.'; }
  }

  refresh();
  return { ok: true, link, mailed, mailError };
}

/** Withdraws every outstanding invitation to a project. */
export async function revokeInvitesAction(projectId: string): Promise<ShareResult> {
  const user = await requireUser();
  if ((await projectRole(user.id, projectId)) !== 'owner') {
    return { ok: false, error: 'רק מי שיצר את הפרויקט יכול לבטל הזמנות' };
  }

  await db.projectInvite.deleteMany({ where: { projectId } });
  refresh();
  return { ok: true };
}

/** The owner removes somebody. */
export async function removeMemberAction(
  projectId: string,
  memberId: string,
): Promise<ShareResult> {
  const user = await requireUser();
  if ((await projectRole(user.id, projectId)) !== 'owner') {
    return { ok: false, error: 'רק מי שיצר את הפרויקט יכול להסיר אנשים' };
  }
  return detach(projectId, memberId, false);
}

/**
 * A member shows themselves out.
 *
 * Its own action rather than "remove me": the client would have to be told its
 * own id to call the other one, and an endpoint that removes whoever you name
 * is a worse thing to have than one that removes only you.
 */
export async function leaveProjectAction(projectId: string): Promise<ShareResult> {
  const user = await requireUser();
  const role = await projectRole(user.id, projectId);
  if (!role) return { ok: false, error: 'הפרויקט לא נמצא' };
  if (role === 'owner') {
    return { ok: false, error: 'מי שיצר את הפרויקט לא יכול לעזוב אותו — אפשר למחוק אותו במקום' };
  }
  return detach(projectId, user.id, true);
}

async function detach(
  projectId: string,
  memberId: string,
  leaving: boolean,
): Promise<ShareResult> {
  await db.$transaction(async (tx) => {
  await tx.projectMember.deleteMany({ where: { projectId, userId: memberId } });

  /* Their tasks stay; only their name comes off them. Removing somebody from a
     project must never delete work — and leaving the tasks assigned to a person
     who can no longer see them would strand them, invisible to everyone. */
  await tx.task.updateMany({
    where: { projectId, assigneeId: memberId },
    data: { assigneeId: null },
  });
  });

  refresh();
  if (leaving) redirect('/app/today');
  return { ok: true };
}

export interface ShareState {
  members: Awaited<ReturnType<typeof projectCollaborators>>;
  /** Whether an invitation is currently outstanding. */
  hasInvite: boolean;
  isOwner: boolean;
  invitations: { id: string; email: string | null; expiresAt: Date }[];
}

/** Everything the share dialog renders, in one call. */
export async function getShareStateAction(projectId: string): Promise<ShareState | null> {
  const user = await requireUser();
  const role = await projectRole(user.id, projectId);
  if (!role) return null;

  const [members, liveInvites] = await Promise.all([
    projectCollaborators(projectId),
    db.projectInvite.count({ where: { projectId, expiresAt: { gt: new Date() } } }),
  ]);

  const invitations = role === 'owner' ? await db.projectInvite.findMany({ where: { projectId, expiresAt: { gt: new Date() } }, select: { id: true, email: true, expiresAt: true }, orderBy: { createdAt: 'desc' } }) : [];
  return { members, hasInvite: liveInvites > 0, isOwner: role === 'owner', invitations };
}

export async function revokeInviteAction(projectId: string, inviteId: string): Promise<ShareResult> {
  const user = await requireUser();
  if ((await projectRole(user.id, projectId)) !== 'owner') return { ok: false, error: 'אין הרשאה לבטל את ההזמנה' };
  await db.projectInvite.deleteMany({ where: { id: inviteId, projectId } });
  refresh();
  return { ok: true };
}
