import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { registerAction } from '@/server/auth/actions';
import { safeAuthRedirect } from '@/lib/auth-redirect';
import { getCurrentUser } from '@/server/auth/session';
import { redirect } from 'next/navigation';
import { accountDestination } from '@/lib/account-role';

export const metadata: Metadata = { title: 'פתיחת חשבון · סדר' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(accountDestination(user, next));
  return <AuthForm mode="register" action={registerAction} next={safeAuthRedirect(next)} />;
}
