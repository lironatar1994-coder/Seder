'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import { requestResetAction, type ResetFormState } from '@/server/auth/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'שולחים…' : 'שליחת קישור'}
    </Button>
  );
}

export function ForgotForm() {
  const [state, formAction] = useActionState<ResetFormState, FormData>(requestResetAction, {});
  const errors = state.errors ?? {};

  if (state.sent) {
    return (
      <div className="animate-fade-up">
        <MailCheck className="size-8 text-accent" aria-hidden />
        <h1 className="display mt-4 text-3xl font-bold text-ink">בדקו את האימייל</h1>
        {/* Worded so it says the same thing whether or not the address is
            registered — otherwise the form reveals who has an account. */}
        <p className="mt-2 leading-relaxed text-muted">
          אם קיים חשבון עם{' '}
          <bdi dir="ltr" className="font-semibold text-ink-2">
            {state.values?.email}
          </bdi>
          , שלחנו לשם קישור לאיפוס הסיסמה. הקישור תקף לשעה אחת.
        </p>
        <p className="mt-6 text-sm text-muted">
          לא הגיע כלום? בדקו בתיקיית הספאם, או{' '}
          <Link href="/forgot" className="font-semibold text-accent underline-offset-4 hover:underline">
            נסו שוב
          </Link>
          .
        </p>
        <p className="mt-6 text-sm text-muted">
          <Link href="/login" className="font-semibold text-accent underline-offset-4 hover:underline">
            חזרה לכניסה
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="display text-4xl font-bold text-ink">איפוס סיסמה</h1>
      <p className="mt-1 text-muted">נשלח קישור לכתובת שרשומה בחשבון.</p>

      <form action={formAction} className="mt-8 space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">אימייל</Label>
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
            autoFocus
          />
          <FieldError id="email-error">{errors.email}</FieldError>
        </div>

        <SubmitButton />
      </form>

      <p className="mt-6 text-sm text-muted">
        נזכרתם?{' '}
        <Link href="/login" className="font-semibold text-accent underline-offset-4 hover:underline">
          כניסה
        </Link>
      </p>
    </div>
  );
}
