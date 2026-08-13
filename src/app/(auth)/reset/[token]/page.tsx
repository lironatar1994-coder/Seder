import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { findResetTarget } from '@/server/auth/reset';
import { ResetForm } from '@/components/auth/reset-form';

export const metadata: Metadata = { title: 'סיסמה חדשה · סדר' };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Checked before rendering the form so a dead link says so immediately
  // instead of after the user has typed a new password twice.
  const target = await findResetTarget(token);

  if (!target) {
    return (
      <div className="animate-fade-up">
        <AlertTriangle className="size-8 text-flag" aria-hidden />
        <h1 className="display mt-4 text-3xl font-bold text-ink">הקישור לא תקף</h1>
        <p className="mt-2 leading-relaxed text-muted">
          קישורי איפוס תקפים לשעה אחת וניתנים לשימוש פעם אחת. אפשר לבקש קישור חדש.
        </p>
        <Link
          href="/forgot"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-accent px-5 font-semibold text-[var(--on-accent)] transition-colors hover:bg-accent-hover"
        >
          בקשת קישור חדש
        </Link>
      </div>
    );
  }

  return <ResetForm token={token} />;
}
