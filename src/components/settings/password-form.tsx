'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, FieldError } from '@/components/ui/field';
import { changePasswordAction, type SettingsState } from '@/server/settings/actions';
import { SettingRow, SettingsSection, SavedNote } from './shell';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'מעדכנים…' : 'עדכון סיסמה'}
    </Button>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState<SettingsState, FormData>(changePasswordAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once the change lands: leaving a password sitting in an
  // input after it has been used is a small hazard for no benefit.
  useEffect(() => {
    if (state.saved) formRef.current?.reset();
  }, [state]);

  const errors = state.errors ?? {};

  return (
    <form ref={formRef} action={formAction}>
      <SettingsSection
        title="סיסמה"
        hideTitle
        description="שינוי הסיסמה מנתק את כל המכשירים האחרים. המכשיר הזה יישאר מחובר."
      >
        {errors._ && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-p1/30 bg-p1/6 px-4 py-3 text-sm font-medium text-p1"
          >
            {errors._}
          </p>
        )}

        <SettingRow
          label="הסיסמה הנוכחית"
          description={
            <>
              לא זוכרים אותה?{' '}
              <Link
                href="/forgot"
                className="font-semibold text-accent underline-offset-4 hover:underline"
              >
                איפוס באמצעות אימייל
              </Link>
            </>
          }
          htmlFor="current-password"
        >
          <Input
            id="current-password"
            name="current"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            className="h-9 py-0 text-start"
            aria-invalid={Boolean(errors.current)}
            aria-describedby={errors.current ? 'current-error' : undefined}
            required
          />
          <FieldError id="current-error">{errors.current}</FieldError>
        </SettingRow>

        <SettingRow label="סיסמה חדשה" description="שמונה תווים לפחות." htmlFor="new-password">
          <Input
            id="new-password"
            name="next"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            className="h-9 py-0 text-start"
            aria-invalid={Boolean(errors.next)}
            aria-describedby={errors.next ? 'next-error' : undefined}
            required
          />
          <FieldError id="next-error">{errors.next}</FieldError>
        </SettingRow>

        <SettingRow label="שוב, לוודא" htmlFor="confirm-password">
          <Input
            id="confirm-password"
            name="confirm"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            className="h-9 py-0 text-start"
            aria-invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? 'confirm-error' : undefined}
            required
          />
          <FieldError id="confirm-error">{errors.confirm}</FieldError>
        </SettingRow>
      </SettingsSection>

      <div className="mt-5 flex items-center gap-3">
        <SubmitButton />
        <SavedNote show={Boolean(state.saved)}>הסיסמה עודכנה</SavedNote>
      </div>
    </form>
  );
}
