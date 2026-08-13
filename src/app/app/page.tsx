import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { isViewSlug } from '@/lib/constants';

/**
 * The app's front door. Sends the user to whichever view they chose in
 * settings, so `/app` — and everything that redirects to it, sign-in included —
 * lands where they expect.
 */
export default async function AppIndex() {
  const user = await getCurrentUser();
  if (!user) redirect('/signed-out');

  // A stored value could be stale if a view were ever renamed; fall back rather
  // than 404 on the very first screen after signing in.
  const view = isViewSlug(user.defaultView) ? user.defaultView : 'today';
  redirect(`/app/${view}`);
}
