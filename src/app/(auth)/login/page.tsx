import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { loginAction } from '@/server/auth/actions';
import { safeAuthRedirect } from '@/lib/auth-redirect';
import { getCurrentUser } from '@/server/auth/session';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'כניסה · סדר' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; next?: string }>;
}) {
  const { reset, next } = await searchParams;
  if (await getCurrentUser()) redirect(safeAuthRedirect(next));
  return <AuthForm mode="login" action={loginAction} justReset={reset === '1'} next={safeAuthRedirect(next)} />;
}
