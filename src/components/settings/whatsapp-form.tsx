'use client';

import Image from 'next/image';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input, FieldError } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { formatPhone } from '@/lib/phone';
import {
  updatePhoneAction,
  setWhatsappSwitchAction,
  setReminderHourAction,
  type WhatsappSwitch,
} from '@/server/settings/whatsapp';
import { hourLabel } from '@/lib/reminder';
import type { SettingsState } from '@/server/settings/actions';
import type { WhatsappState } from '@/server/whatsapp/status';
import { SettingRow, SettingsSection, SavedNote } from './shell';

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? 'שומרים…' : 'שמירה'}
    </Button>
  );
}

/** What the connection line says, for a reader who does not run the server. */
const CONNECTION: Record<WhatsappState['status'], { text: string; tone: 'ok' | 'warn' | 'bad' }> = {
  READY: { text: 'מחובר', tone: 'ok' },
  NEEDS_SCAN: { text: 'ממתין לחיבור מכשיר', tone: 'warn' },
  INITIALIZING: { text: 'מתחבר…', tone: 'warn' },
  DISCONNECTED: { text: 'מנותק, מנסה שוב', tone: 'warn' },
  LOGGED_OUT: { text: 'נותק — צריך לחבר מחדש', tone: 'bad' },
  ERROR: { text: 'תקלה', tone: 'bad' },
  OFFLINE: { text: 'השירות לא פועל', tone: 'bad' },
};

export function WhatsappForm({
  phone,
  capture,
  reminders,
  reminderHour,
  state,
  isAdmin,
  recent,
}: {
  phone: string | null;
  capture: boolean;
  reminders: boolean;
  reminderHour: number;
  state: WhatsappState;
  /** Only the operator pairs the number, so only they see the code. */
  isAdmin: boolean;
  recent: { id: string; body: string; direction: string; status: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [phoneState, phoneAction] = useActionState<SettingsState, FormData>(updatePhoneAction, {});
  const [value, setValue] = useState(phone ? formatPhone(phone) : '');
  const [showSaved, setShowSaved] = useState(false);

  const [onCapture, setOnCapture] = useState(capture);
  const [onReminders, setOnReminders] = useState(reminders);
  const [hour, setHour] = useState(reminderHour);
  const [hourSaved, setHourSaved] = useState(false);
  const [switchError, setSwitchError] = useState<Partial<Record<WhatsappSwitch, string>>>({});
  const [, startToggle] = useTransition();

  useEffect(() => {
    if (phoneState.saved) setShowSaved(true);
  }, [phoneState]);

  // "+972-54-123-4567" is stored as "0541234567", so after a save the field
  // still holds a spelling that no longer matches what is on record — the form
  // reads as unsaved, the Save button stays live, and the confirmation never
  // shows. Following the stored value also shows the user what we made of it.
  useEffect(() => {
    setValue(phone ? formatPhone(phone) : '');
  }, [phone]);

  // While a code is on screen it is being scanned, and it rotates. Poll only
  // then: a connected service has nothing to say that is worth a request every
  // ten seconds on every settings page.
  useEffect(() => {
    if (state.status !== 'NEEDS_SCAN' && state.status !== 'INITIALIZING') return;
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [state.status, router]);

  const connection = CONNECTION[state.status] ?? CONNECTION.OFFLINE;
  const dirty = value.trim() !== (phone ? formatPhone(phone) : '');

  /* Optimistic, then reverted if the server refuses — a switch that waits for
     a round trip before moving reads as broken. */
  function toggle(which: WhatsappSwitch, next: boolean) {
    const apply = which === 'capture' ? setOnCapture : setOnReminders;
    apply(next);
    setSwitchError((prev) => ({ ...prev, [which]: undefined }));

    startToggle(async () => {
      const result = await setWhatsappSwitchAction(which, next);
      if (result.errors) {
        apply(!next);
        setSwitchError((prev) => ({ ...prev, [which]: result.errors?.[which] }));
      }
    });
  }

  return (
    <>
      <SettingsSection
        title="וואטסאפ"
        hideTitle
        description="שולחים הודעה למספר של סדר, ונפתחת משימה. אותו תחביר של ההוספה המהירה — ‏מחר, בשעה 14:30, ‏#פרויקט."
      >
        <form action={phoneAction}>
          <SettingRow
            label="המספר שלי"
            description="ממנו נזהה שההודעה שלך, ואליו יגיעו התזכורות."
            htmlFor="settings-phone"
          >
            <div className="flex items-center gap-2">
              <Input
                id="settings-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="054-123-4567"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setShowSaved(false);
                }}
                aria-invalid={Boolean(phoneState.errors?.phone)}
                aria-describedby={phoneState.errors?.phone ? 'phone-error' : undefined}
                // A phone number types left-to-right, so the field is LTR — but
                // `dir` also decides where the text sits, and left-aligned it
                // was the only value on the page hugging the far edge. `end`
                // in an LTR box is the right edge, which is where every other
                // field in this form starts.
                dir="ltr"
                className="h-9 py-0 text-end"
              />
              <SaveButton disabled={!dirty} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <FieldError id="phone-error">{phoneState.errors?.phone}</FieldError>
              <SavedNote show={showSaved && !dirty} />
            </div>
          </SettingRow>
        </form>

        {/* Two switches, because they are two permissions. Letting the app read
            your messages is a different decision from letting it message you,
            and one control forced them to be the same answer. */}
        <SettingRow
          label="פתיחת משימות מהודעות"
          description={
            phone
              ? 'הודעה שתשלח למספר של סדר תיפתח כמשימה. כשזה כבוי, ההודעות פשוט לא ייקלטו.'
              : 'צריך לשמור מספר קודם.'
          }
          htmlFor="settings-whatsapp-capture"
          control="auto"
        >
          <div className="flex items-center gap-3">
            <Switch
              id="settings-whatsapp-capture"
              checked={onCapture}
              disabled={!phone}
              onChange={(next) => toggle('capture', next)}
              aria-label="פתיחת משימות מהודעות"
            />
            <FieldError>{switchError.capture}</FieldError>
          </div>
        </SettingRow>

        <SettingRow
          label="קבלת תזכורות"
          description={
            phone
              ? 'תזכורות על משימות יגיעו לוואטסאפ. כשזה כבוי, אפשר עדיין לפתוח משימות בהודעה.'
              : 'צריך לשמור מספר קודם.'
          }
          htmlFor="settings-whatsapp-reminders"
          control="auto"
        >
          <div className="flex items-center gap-3">
            <Switch
              id="settings-whatsapp-reminders"
              checked={onReminders}
              disabled={!phone}
              onChange={(next) => toggle('reminders', next)}
              aria-label="קבלת תזכורות"
            />
            <FieldError>{switchError.reminders}</FieldError>
          </div>
        </SettingRow>

        <SettingRow
          label="שעת התזכורת היומית"
          description="משימה שיש לה תאריך אבל אין לה שעה — התזכורת עליה תגיע בשעה הזאת, יחד עם שאר המשימות של אותו יום."
          htmlFor="settings-reminder-hour"
        >
          <div className="flex items-center gap-2">
            <select
              id="settings-reminder-hour"
              value={hour}
              onChange={(event) => {
                const next = Number(event.target.value);
                setHour(next);
                setHourSaved(false);
                startToggle(async () => {
                  const result = await setReminderHourAction(next);
                  if (!result.errors) setHourSaved(true);
                });
              }}
              // 36px is right beside dense content and wrong under a thumb.
              className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink [@media(pointer:coarse)]:h-11"
            >
              {Array.from({ length: 24 }, (_, value) => (
                <option key={value} value={value}>
                  {hourLabel(value)}
                </option>
              ))}
            </select>
            <SavedNote show={hourSaved} />
          </div>
        </SettingRow>

        <SettingRow label="מצב השירות" description="החיבור משותף לכל המשתמשים." control="auto">
          <span
            className={
              connection.tone === 'ok'
                ? 'text-sm font-semibold text-accent'
                : connection.tone === 'warn'
                  ? 'text-sm font-semibold text-p2'
                  : 'text-sm font-semibold text-p1'
            }
          >
            {/* A crashed worker leaves its last line behind — READY, or
                "reconnecting" with nothing reconnecting. The file is rewritten
                every minute while the process lives, so an old timestamp means
                the process is gone, whatever the line says. */}
            {state.stale && state.status !== 'OFFLINE' ? 'לא מגיב' : connection.text}
          </span>
        </SettingRow>
      </SettingsSection>

      {isAdmin && state.qr && state.status === 'NEEDS_SCAN' && (
        <SettingsSection
          title="חיבור מכשיר"
          description="בוואטסאפ: הגדרות ← מכשירים מקושרים ← קישור מכשיר, ולסרוק."
        >
          <div className="py-4">
            <Image
              src={state.qr}
              alt="קוד לסריקה בוואטסאפ"
              width={264}
              height={264}
              unoptimized
              className="rounded-xl border border-line bg-white p-3"
            />
            <p className="mt-2 text-xs text-muted">הקוד מתחדש כל דקה.</p>
          </div>
        </SettingsSection>
      )}

      {isAdmin && state.reason && state.status !== 'READY' && (
        <SettingsSection title="פרטי התקלה">
          <p dir="auto" className="py-4 font-mono text-xs text-muted">
            {state.reason}
          </p>
        </SettingsSection>
      )}

      <SettingsSection title="הודעות אחרונות" description="עשר האחרונות, נכנסות ויוצאות.">
        {recent.length === 0 ? (
          <p className="py-4 text-sm text-muted">עוד לא עברו הודעות.</p>
        ) : (
          <ul>
            {recent.map((row) => (
              <li key={row.id} className="flex items-start gap-3 border-be border-line py-2.5">
                <span className="w-14 shrink-0 text-xs font-semibold text-muted">
                  {row.direction === 'IN' ? 'נכנסת' : 'יוצאת'}
                </span>
                <span dir="auto" className="min-w-0 flex-1 truncate text-sm text-ink-2">
                  {row.body}
                </span>
                {/* The time always, and the outcome as well when it was not
                    "sent" — showing one or the other dropped the timestamp
                    from exactly the rows worth timestamping. */}
                <span className="num shrink-0 text-xs text-muted">{row.createdAt}</span>
                {row.status !== 'sent' && (
                  <span className="shrink-0 text-xs font-semibold text-p2">
                    {row.status === 'failed' ? 'נכשלה' : 'לא טופלה'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </>
  );
}
