'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import type { AuthFormState } from '@/server/auth/actions';

type Mode = 'login' | 'register';

const COPY = {
  login: {
    title: 'ברוכים השבים',
    lede: 'היום מחכה.',
    submit: 'כניסה',
    pending: 'נכנסים…',
    switchText: 'עוד אין לכם חשבון?',
    switchCta: 'פתיחת חשבון',
    switchHref: '/register',
  },
  register: {
    title: 'פותחים חשבון',
    lede: 'דקה, וכבר אפשר להתחיל לסדר.',
    submit: 'יצירת חשבון',
    pending: 'יוצרים…',
    switchText: 'כבר יש לכם חשבון?',
    switchCta: 'כניסה',
    switchHref: '/login',
  },
} as const;

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  action,
  justReset = false,
}: {
  mode: Mode;
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  /** Arriving straight from a completed password reset. */
  justReset?: boolean;
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {});
  const copy = COPY[mode];
  const errors = state.errors ?? {};

  return (
    <div className="animate-fade-up">
      <h1 className="display text-4xl font-bold text-ink">{copy.title}</h1>
      <p className="mt-1 text-muted">{copy.lede}</p>

      {justReset && !errors._ && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm font-medium text-accent"
        >
          הסיסמה עודכנה. אפשר להיכנס איתה עכשיו.
        </p>
      )}

      <form action={formAction} className="mt-8 space-y-5" noValidate>
        {errors._ && (
          <div
            role="alert"
            data-testid="form-error"
            className="rounded-lg border border-p1/30 bg-p1/6 px-4 py-3 text-sm font-medium text-p1"
          >
            {errors._}
          </div>
        )}

        {mode === 'register' && (
          <div className="space-y-1.5">
            <Label htmlFor="name">שם</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              defaultValue={state.values?.name}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              required
            />
            <FieldError id="name-error">{errors.name}</FieldError>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">אימייל</Label>
          {/* An email address is always LTR — letting it inherit RTL puts the
              domain on the wrong side while you type. */}
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            className="text-start"
            defaultValue={state.values?.email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            required
          />
          <FieldError id="email-error">{errors.email}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">סיסמה</Label>
          <Input
            id="password"
            name="password"
            type="password"
            dir="ltr"
            className="text-start"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'password-error' : mode === 'register' ? 'password-hint' : undefined
            }
            required
          />
          {mode === 'register' && !errors.password && (
            <p id="password-hint" className="text-sm text-muted">
              שמונה תווים לפחות.
            </p>
          )}
          <FieldError id="password-error">{errors.password}</FieldError>
          {mode === 'login' && (
            <p className="pt-0.5 text-sm">
              <Link
                href="/forgot"
                className="text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                שכחתי סיסמה
              </Link>
            </p>
          )}
        </div>

        <SubmitButton label={copy.submit} pendingLabel={copy.pending} />
      </form>

      <p className="mt-6 text-sm text-muted">
        {copy.switchText}{' '}
        <Link
          href={copy.switchHref}
          className="font-semibold text-accent underline-offset-4 hover:underline"
        >
          {copy.switchCta}
        </Link>
      </p>
    </div>
  );
}
