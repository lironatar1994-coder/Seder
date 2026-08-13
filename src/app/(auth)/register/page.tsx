import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { registerAction } from '@/server/auth/actions';

export const metadata: Metadata = { title: 'פתיחת חשבון · סדר' };

export default function RegisterPage() {
  return <AuthForm mode="register" action={registerAction} />;
}
