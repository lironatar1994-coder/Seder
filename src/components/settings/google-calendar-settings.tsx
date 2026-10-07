'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, ChevronDown, LoaderCircle, RefreshCw } from 'lucide-react';
import type { GoogleSettingsDTO } from '@/lib/calendar-event-types';
import { revokeCalendarFeedAction, disconnectGoogleAction, syncGoogleAction, updateGoogleSettings } from '@/server/google/actions';
import { Button } from '@/components/ui/button';
import { SettingRow } from './shell';

const MESSAGES: Record<string, string> = {
  connected: 'היומן חובר. הסנכרון יתעדכן אוטומטית.',
  cancelled: 'החיבור בוטל. אפשר לנסות שוב.',
  invalid: 'בקשת החיבור פגה. נסו לחבר את היומן שוב.',
  permissions: 'חסרות הרשאות ליומן. נסו שוב ואשרו את הגישה ב־Google.',
  failed: 'החיבור לא הושלם. נסו שוב.',
  unavailable: 'החיבור ל־Google עדיין לא זמין.',
  'disconnect-first': 'נתקו את החשבון הנוכחי לפני חיבור חשבון אחר.',
  busy: 'הסנכרון כבר מתבצע. נסו בעוד רגע.',
  RECONNECT: 'ההרשאה פגה. חברו מחדש את היומן.',
  PERMISSIONS: 'חסרות הרשאות. חברו מחדש את היומן.',
  SYNC_FAILED: 'הסנכרון לא הושלם. נסו לסנכרן שוב.',
  BUSY: 'הסנכרון כבר מתבצע. נסו בעוד רגע.',
};

const disclosureClass = 'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden';
const connectClass = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 text-base font-semibold text-[var(--on-accent)] transition-colors hover:bg-accent-hover sm:w-auto';

export function GoogleCalendarSettings({ configured, connection, feedback, feedActive, setupCallback }: {
  configured: boolean;
  connection: GoogleSettingsDTO | null;
  feedback?: string;
  feedActive: boolean;
  setupCallback: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [showEvents, setShowEvents] = useState(connection?.showEvents ?? true);
  const [calendars, setCalendars] = useState(connection?.sources.filter(source => source.enabled).map(source => source.id) ?? []);

  useEffect(() => {
    setShowEvents(connection?.showEvents ?? true);
    setCalendars(connection?.sources.filter(source => source.enabled).map(source => source.id) ?? []);
  }, [connection]);

  // A cancelled account chooser can return through the browser's back cache.
  useEffect(() => {
    const resetConnecting = () => setConnecting(false);
    window.addEventListener('pageshow', resetConnecting);
    return () => window.removeEventListener('pageshow', resetConnecting);
  }, []);

  function run(action: () => Promise<{ ok: boolean; error?: string; warning?: string }>, success: string) {
    setMessage('');
    start(async () => {
      try {
        const result = await action();
        setMessage(result.ok ? result.warning ? `${success} ${MESSAGES[result.warning] ?? MESSAGES.SYNC_FAILED}` : success : MESSAGES[result.error ?? ''] ?? 'הפעולה לא הושלמה. נסו שוב.');
        if (result.ok) setConfirmDisconnect(false);
        router.refresh();
      } catch { setMessage('הפעולה לא הושלמה. נסו שוב.'); }
    });
  }

  const reconnect = connection?.lastError === 'RECONNECT' || connection?.lastError === 'PERMISSIONS';
  const statusMessage = message || MESSAGES[feedback ?? ''] || MESSAGES[connection?.lastError ?? ''];

  return <section aria-labelledby="google-calendar-title" className="pt-6">
    <div className="pb-6">
      <h2 id="google-calendar-title" className="flex items-center gap-2 text-lg font-bold text-ink">
        <CalendarDays className="size-5 text-muted" aria-hidden />יומן Google
      </h2>
      {connection ? <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-ink-2">
        <Check className="size-4 shrink-0" aria-hidden />
        <span>{reconnect ? 'נדרש חיבור מחדש' : 'חשבון מחובר'}</span>
        <bdi dir="ltr" className="min-w-0 break-all">{connection.accountEmail}</bdi>
      </div> : <p className="mt-1 text-sm text-muted">אירועי Google מופיעים אוטומטית בסדר. לקריאה בלבד.</p>}

      <div className="mt-5">
        {!connection || reconnect ? <>
          {configured ? <a
            href="/seder/api/google/connect"
            className={`${connectClass}${connecting ? ' pointer-events-none opacity-70' : ''}`}
            aria-busy={connecting}
            aria-disabled={connecting || undefined}
            onClick={() => setConnecting(true)}
          >
            {connecting && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
            {connecting ? 'פותחים את Google…' : connection ? 'חיבור מחדש' : 'חיבור יומן Google'}
          </a> : <>
            <Button disabled className="min-h-12 w-full sm:w-auto" aria-describedby="google-unavailable">{connection ? 'חיבור מחדש' : 'חיבור יומן Google'}</Button>
            <p id="google-unavailable" className="mt-2 text-sm text-muted">החיבור ל־Google עדיין לא זמין.</p>
          </>}
        </> : <div className="flex flex-wrap items-center gap-3">
          <Button disabled={pending || !configured} onClick={() => run(syncGoogleAction, 'היומן מסונכרן.')}>
            <RefreshCw className={`size-4${pending ? ' motion-safe:animate-spin' : ''}`} aria-hidden />
            {pending ? 'מסנכרנים…' : 'סנכרון עכשיו'}
          </Button>
          <span className="text-xs text-muted">{connection.lastSyncAt ? `סנכרון אחרון: ${new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(connection.lastSyncAt))}` : 'ממתין לסנכרון ראשון'}</span>
        </div>}
      </div>
      {statusMessage && <p role="status" className="mt-3 text-sm text-ink-2">{statusMessage}</p>}
    </div>

    {connection && <details className="group border-bs border-line">
      <summary className={disclosureClass}>העדפות סנכרון<ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden /></summary>
      <div className="pb-4">
        <SettingRow label="הצגת אירועי Google בסדר" htmlFor="google-show-events" control="auto"><input id="google-show-events" type="checkbox" checked={showEvents} onChange={event => setShowEvents(event.target.checked)} className="size-5 accent-[var(--accent)]" /></SettingRow>
        {showEvents && <SettingRow label="יומנים להצגה" align="start">
          <div>{connection.sources.length ? connection.sources.map(source => <label key={source.id} className="flex min-h-11 items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={calendars.includes(source.id)} onChange={event => setCalendars(list => event.target.checked ? [...list, source.id] : list.filter(id => id !== source.id))} className="size-4 accent-[var(--accent)]" />
            <span dir="auto" className="min-w-0 break-words">{source.name}</span>
          </label>) : <p className="text-sm text-muted">היומנים יופיעו לאחר הסנכרון הראשון.</p>}</div>
        </SettingRow>}
        <div className="py-4"><Button disabled={pending} onClick={() => run(() => updateGoogleSettings({ showEvents, calendars }), 'ההעדפות נשמרו.')}>{pending ? 'שומרים…' : 'שמירת העדפות'}</Button></div>
        <p className="text-sm text-muted">השינויים ב־Google מתעדכנים בסדר אוטומטית. סדר לא משנה דבר ביומן Google.</p>
        <div className="mt-4">
          {confirmDisconnect ? <>
            <p className="mb-2 text-sm text-ink-2">לנתק את היומן? האירועים יוסרו מסדר ויישארו ב־Google.</p>
            <div className="flex flex-wrap gap-2"><Button variant="danger" disabled={pending} onClick={() => run(disconnectGoogleAction, 'היומן נותק.')}>אישור ניתוק</Button><Button variant="ghost" disabled={pending} onClick={() => setConfirmDisconnect(false)}>ביטול</Button></div>
          </> : <Button variant="ghost" disabled={pending} onClick={() => setConfirmDisconnect(true)}>ניתוק</Button>}
        </div>
      </div>
    </details>}

    {feedActive && <details className="group border-bs border-line">
      <summary className={disclosureClass}>קישור מנוי קיים<ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden /></summary>
      <div className="space-y-3 pb-4">
        <p className="text-sm text-muted">קישור המנוי הישן מאפשר לקרוא משימות סדר ביומן חיצוני. אפשר לבטל אותו כאן.</p>
        <Button variant="ghost" disabled={pending} onClick={() => run(revokeCalendarFeedAction, 'קישור המנוי בוטל.')}>ביטול קישור המנוי</Button>
      </div>
    </details>}

    {setupCallback && <details className="group border-bs border-line">
      <summary className={disclosureClass}>הגדרת החיבור למנהל<ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden /></summary>
      <div className="space-y-2 pb-4 text-sm text-muted">
        <p>יש להגדיר את אפליקציית Google של סדר כדי לאפשר חיבור בלחיצה. כתובת החזרה ב־Google Cloud:</p>
        <code dir="ltr" className="block break-all rounded bg-surface-2 p-3 text-xs text-ink-2">{setupCallback}</code>
      </div>
    </details>}
  </section>;
}
