'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import { resetPasswordAction, type ResetPasswordState } from '@/server/auth/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'שומרים…' : 'שמירת סיסמה חדשה'}
    </Button>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    {},
  );
  const errors = state.errors ?? {};

  return (
    <div className="animate-fade-up">
      <h1 className="display text-4xl font-bold text-ink">סיסמה חדשה</h1>
      <p className="mt-1 text-muted">אחרי השמירה תצטרכו להיכנס מחדש בכל המכשירים.</p>

      <form action={formAction} className="mt-8 space-y-5" noValidate>
        <input type="hidden" name="token" value={token} />

        {errors._ && (
          <div
            role="alert"
            data-testid="form-error"
            className="rounded-lg border border-p1/30 bg-p1/6 px-4 py-3 text-sm font-medium text-p1"
          >
            {errors._}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="password">סיסמה חדשה</Label>
          <Input
            id="password"
            name="password"
            type="password"
            dir="ltr"
            className="text-start"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            required
            autoFocus
          />
          {!errors.password && (
            <p id="password-hint" className="text-sm text-muted">
              שמונה תווים לפחות.
            </p>
          )}
          <FieldError id="password-error">{errors.password}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">שוב, לוודא</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            dir="ltr"
            className="text-start"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? 'confirm-error' : undefined}
            required
          />
          <FieldError id="confirm-error">{errors.confirm}</FieldError>
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}
