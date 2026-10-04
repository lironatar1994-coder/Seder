import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { registerAction } from '@/server/auth/actions';
import { safeAuthRedirect } from '@/lib/auth-redirect';
import { getCurrentUser } from '@/server/auth/session';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'פתיחת חשבון · סדר' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeAuthRedirect(next));
  return <AuthForm mode="register" action={registerAction} next={safeAuthRedirect(next)} />;
}
