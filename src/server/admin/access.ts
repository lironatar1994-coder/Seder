import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getCurrentSession } from '@/server/auth/session';
import { isAdministrator } from '@/lib/account-role';

/** Every cross-account read verifies the live database role before querying. */
export async function requireAdministrator() {
  const session = await getCurrentSession();
  if (!session) redirect('/signed-out?next=%2Fadmin');
  if (!isAdministrator(session.user)) notFound();
  return session;
}
