'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/overlays';
import { useToast } from '@/components/ui/toast';
import {
  deleteAccountAction,
  signOutOtherSessionsAction,
  type SettingsState,
} from '@/server/settings/actions';
import { SettingRow, SettingsSection, DangerRow } from './shell';

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? 'מוחקים…' : 'מחיקה לצמיתות'}
    </Button>
  );
}

export function AccountForm({ otherSessions }: { otherSessions: number }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, formAction] = useActionState<SettingsState, FormData>(deleteAccountAction, {});
  const { toast } = useToast();

  function signOutOthers() {
    startTransition(async () => {
      await signOutOtherSessionsAction();
      toast({ message: 'המכשירים האחרים נותקו' });
    });
  }

  return (
    <>
      <SettingsSection title="מכשירים">
        <SettingRow
          label="מכשירים מחוברים"
          description={
            otherSessions === 0
              ? 'המכשיר הזה הוא היחיד שמחובר לחשבון.'
              : `מלבד המכשיר הזה מחוברים עוד ${otherSessions} מכשירים.`
          }
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={signOutOthers}
            disabled={otherSessions === 0 || pending}
            className="w-full"
          >
            {pending ? 'מנתקים…' : 'ניתוק שאר המכשירים'}
          </Button>
        </SettingRow>
      </SettingsSection>

      {/* The one irreversible action in the app. A dialog is earned here: it
          needs protected focus and a deliberate second step. */}
      <section className="pt-10">
        <h2 className="text-sm font-bold text-ink">אזור מסוכן</h2>
        <div className="mt-4">
          <DangerRow
            label="מחיקת החשבון"
            description="כל המשימות, הפרויקטים והתוויות יימחקו יחד עם החשבון. אי אפשר לשחזר."
          >
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              מחיקת החשבון
            </Button>
          </DangerRow>
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="מחיקת החשבון"
          description="הפעולה לא הפיכה. כדי לאשר, הזינו את הסיסמה."
        >
          <form action={formAction} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">סיסמה</Label>
              <Input
                id="delete-password"
                name="password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                className="text-start"
                aria-invalid={Boolean(state.errors?.password)}
                aria-describedby={state.errors?.password ? 'delete-error' : undefined}
                required
                autoFocus
              />
              <FieldError id="delete-error">
                {state.errors?.password ?? state.errors?._}
              </FieldError>
            </div>

            <DialogFooter>
              <DeleteButton />
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                ביטול
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
