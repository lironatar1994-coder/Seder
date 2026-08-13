import type { Metadata } from 'next';
import { ForgotForm } from '@/components/auth/forgot-form';

export const metadata: Metadata = { title: 'איפוס סיסמה · סדר' };

export default function ForgotPage() {
  return <ForgotForm />;
}
