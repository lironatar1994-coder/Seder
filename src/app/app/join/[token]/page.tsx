import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { acceptInvite } from '@/server/sharing/invites';

/**
 * Landing point for an invitation link.
 *
 * It sits under `/app`, so the middleware sends a signed-out visitor to the
 * login page — an invitation that dead-ends at "please sign in" with no way
 * back is the most common way this flow is broken.
 *
 * Accepting happens on load rather than behind a confirm button: the decision
 * was made when the link was clicked, and a second "yes, really" only adds a
 * step. The only thing rendered is a failure.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser();

  const result = await acceptInvite(user.id, token);
  if ('projectId' in result) redirect(`/app/project/${result.projectId}`);

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="display text-3xl text-ink">ההזמנה לא נקלטה</h1>
      <p className="mt-3 text-muted">{result.error}</p>
      <Link
        href="/app/today"
        className="mt-6 inline-flex h-11 items-center rounded-lg bg-accent px-4 font-semibold text-[var(--on-accent)] transition-colors hover:bg-accent-hover"
      >
        חזרה להיום
      </Link>
    </div>
  );
}
