'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input, FieldError } from '@/components/ui/field';
import { updateNameAction, type SettingsState } from '@/server/settings/actions';
import { SettingRow, SettingsSection, SavedNote } from './shell';

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? 'שומרים…' : 'שמירה'}
    </Button>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction] = useActionState<SettingsState, FormData>(updateNameAction, {});
  const [value, setValue] = useState(name);

  // The confirmation is for the change just made; a later edit clears it.
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (state.saved) setShowSaved(true);
  }, [state]);

  const dirty = value.trim() !== name && value.trim().length > 0;

  return (
    <form action={formAction}>
      <SettingsSection title="פרופיל" hideTitle>
        <SettingRow label="שם" description="מופיע בתפריט המשתמש." htmlFor="settings-name">
          <div className="flex items-center gap-2">
            <Input
              id="settings-name"
              name="name"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setShowSaved(false);
              }}
              aria-invalid={Boolean(state.errors?.name)}
              aria-describedby={state.errors?.name ? 'name-error' : undefined}
              className="h-9 py-0"
            />
            <SaveButton disabled={!dirty} />
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <FieldError id="name-error">{state.errors?.name}</FieldError>
            <SavedNote show={showSaved && !dirty} />
          </div>
        </SettingRow>

        <SettingRow
          label="אימייל"
          description="הכתובת משמשת לכניסה ולאיפוס סיסמה. שינוי כתובת עוד לא נתמך."
        >
          {/* An email is an LTR island; bdi keeps it from reordering the Hebrew
              around it. Read-only rather than a disabled input, which would
              look like a control that is temporarily unavailable. */}
          <bdi
            dir="ltr"
            className="block truncate rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2"
          >
            {email}
          </bdi>
        </SettingRow>
      </SettingsSection>
    </form>
  );
}
