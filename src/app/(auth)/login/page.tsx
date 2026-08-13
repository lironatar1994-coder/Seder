import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { loginAction } from '@/server/auth/actions';

export const metadata: Metadata = { title: 'כניסה · סדר' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  return <AuthForm mode="login" action={loginAction} justReset={reset === '1'} />;
}
