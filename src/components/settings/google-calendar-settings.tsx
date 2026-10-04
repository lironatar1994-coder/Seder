'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import type { GoogleSettingsDTO } from '@/lib/calendar-event-types';
import { createCalendarFeedAction, revokeCalendarFeedAction, disconnectGoogleAction, syncGoogleAction, updateGoogleSettings } from '@/server/google/actions';
import { Button } from '@/components/ui/button';
import { SettingsSection, SettingRow } from './shell';

const MESSAGES: Record<string, string> = {
  connected: 'יומן Google מחובר. אפשר לסנכרן עכשיו; לאחר מכן הסנכרון מתבצע אוטומטית.',
  cancelled: 'החיבור בוטל. אפשר לנסות שוב כשמתאים.', invalid: 'תוקף בקשת החיבור פג. יש להתחיל את החיבור מחדש.',
  permissions: 'לא התקבלו כל ההרשאות הדרושות. בחיבור הבא יש לאשר את הרשאות היומן.',
  failed: 'החיבור לא הושלם. אפשר לנסות שוב.', unavailable: 'החיבור הישיר ל־Google עדיין לא הופעל עבור סדר.',
  'disconnect-first': 'כדי לחבר חשבון Google אחר, יש לנתק תחילה את החשבון הנוכחי.', busy: 'הסנכרון כבר מתבצע. אפשר לנסות בעוד רגע.',
  RECONNECT: 'Google ביטלה את הרשאת החיבור. יש לחבר מחדש את החשבון.', PERMISSIONS: 'יש לבדוק את הרשאות היומן ולחבר מחדש.',
  CALENDAR_REMOVED: 'יומן סדר נמחק ב־Google. בסנכרון הבא ייווצר יומן חדש.', SYNC_FAILED: 'הסנכרון האחרון לא הושלם. המידע הקודם נשמר; אפשר לנסות שוב.', BUSY: 'הסנכרון כבר מתבצע. אפשר לנסות בעוד רגע.',
  MORE_TASKS: 'משימות נוספות ממתינות ויתעדכנו אוטומטית בהמשך הסנכרון.',
};
export function GoogleCalendarSettings({ configured, connection, feedback, feedActive, setupCallback }: { configured: boolean; connection: GoogleSettingsDTO | null; feedback?: string; feedActive: boolean; setupCallback: string | null }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [message, setMessage] = useState(''); const [feedUrl, setFeedUrl] = useState<string | null>(null); const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [showEvents, setShowEvents] = useState(connection?.showEvents ?? true); const [syncTasks, setSyncTasks] = useState(connection?.syncTasks ?? true); const [syncAllDay, setSyncAllDay] = useState(connection?.syncAllDay ?? true); const [calendars, setCalendars] = useState(connection?.sources.filter(source => source.enabled).map(source => source.id) ?? []);
  useEffect(() => { setShowEvents(connection?.showEvents ?? true); setSyncTasks(connection?.syncTasks ?? true); setSyncAllDay(connection?.syncAllDay ?? true); setCalendars(connection?.sources.filter(source => source.enabled).map(source => source.id) ?? []); }, [connection]);
  function run(action: () => Promise<{ ok: boolean; error?: string; warning?: string }>, success: string) { setMessage(''); start(async () => { try { const result = await action(); setMessage(result.ok ? result.warning ? `${success} ${MESSAGES[result.warning] ?? MESSAGES.SYNC_FAILED}` : success : MESSAGES[result.error ?? ''] ?? 'הפעולה לא הושלמה. אפשר לנסות שוב.'); router.refresh(); } catch { setMessage('הפעולה לא הושלמה. אפשר לנסות שוב.'); } }); }
  return <>
    <SettingsSection title="יומן Google" description="הפגישות והמשימות באותו מקום. אירועים מהיומנים שבחרתם יופיעו בסדר, ומשימות מתוזמנות יישלחו ליומן נפרד בשם סדר.">
      <SettingRow label={connection ? 'חשבון מחובר' : 'חיבור חשבון Google'} description={connection ? <bdi dir="ltr">{connection.accountEmail}</bdi> : 'בוחרים חשבון ומאשרים גישה ליומנים. סדר משנה רק אירועים ביומן שהיא יוצרת.'} control="auto">
        {configured ? <Link href="/api/google/connect" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2"><CalendarDays className="size-4" aria-hidden />{connection ? 'חיבור מחדש' : 'חיבור Google Calendar'}</Link> : <span className="text-sm text-muted">החיבור הישיר ממתין להפעלה</span>}
      </SettingRow>
      {connection && <>
        <SettingRow label="הצגת אירועים בסדר" description="אירועי Google מופיעים בתצוגות היום, בקרוב ולוח השנה." control="auto"><input type="checkbox" aria-label="הצגת אירועים בסדר" checked={showEvents} onChange={event => setShowEvents(event.target.checked)} className="size-5 accent-[var(--accent)]" /></SettingRow>
        {showEvents && <SettingRow label="יומנים להצגה" description="אפשר לבחור עד 20 יומנים." align="start"><div className="space-y-2">{connection.sources.length ? connection.sources.map(source => <label key={source.id} className="flex min-h-9 items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={calendars.includes(source.id)} onChange={event => setCalendars(list => event.target.checked ? [...list, source.id] : list.filter(id => id !== source.id))} className="size-4 accent-[var(--accent)]" /><span dir="auto" className="min-w-0 break-words">{source.name}</span></label>) : <p className="text-sm text-muted">רשימת היומנים תופיע לאחר הסנכרון הראשון.</p>}</div></SettingRow>}
        <SettingRow label="סנכרון משימות ל־Google" description="משימות אישיות ומשימות שהוקצו לכם בפרויקטים משותפים. שינוי שם, תאריך, שעה ומשך ב־Google יתעדכן גם בסדר." control="auto"><input type="checkbox" aria-label="סנכרון משימות ל־Google" checked={syncTasks} onChange={event => setSyncTasks(event.target.checked)} className="size-5 accent-[var(--accent)]" /></SettingRow>
        <SettingRow label="גם משימות ליום שלם" description="משימות עם תאריך ובלי שעה יופיעו כאירועים ליום שלם." control="auto"><input type="checkbox" aria-label="גם משימות ליום שלם" disabled={!syncTasks} checked={syncAllDay} onChange={event => setSyncAllDay(event.target.checked)} className="size-5 accent-[var(--accent)] disabled:opacity-40" /></SettingRow>
        <div className="flex flex-wrap items-center gap-2 py-4"><Button size="sm" disabled={pending} onClick={() => run(() => updateGoogleSettings({ showEvents, syncTasks, syncAllDay, calendars }), 'העדפות היומן נשמרו.')}>שמירת העדפות</Button><Button variant="secondary" size="sm" disabled={pending || !configured} onClick={() => run(syncGoogleAction, 'היומן מסונכרן.')}><RefreshCw className="size-4" aria-hidden />{pending ? 'מעדכנים…' : 'סנכרון עכשיו'}</Button><span className="text-xs text-muted">{connection.lastSyncAt ? `סנכרון אחרון: ${new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(connection.lastSyncAt))}` : 'ממתין לסנכרון ראשון'}</span></div>
        <p className="pb-4 text-xs leading-relaxed text-muted">הסנכרון מתעדכן בערך פעם בדקה. כשמשנים את שני הצדדים יחד, השינוי בסדר מקבל עדיפות. מחיקת אירוע משויך ב־Google מסירה את התזמון ומשאירה את המשימה. משימה חוזרת שולחת את המופע הנוכחי, ובהשלמתו את המופע הבא. כיבוי סנכרון המשימות מסיר רק את האירועים שסדר סנכרנה.</p>
        <SettingRow label="ניתוק היומן" description="מפסיק את הסנכרון ומוחק מסדר את האירועים המיובאים ופרטי החיבור. האירועים שכבר נוצרו ב־Google נשארים שם." control="auto">{confirmDisconnect ? <div className="flex gap-2"><Button variant="danger" size="sm" disabled={pending} onClick={() => run(disconnectGoogleAction, 'היומן נותק.')}>אישור ניתוק</Button><Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmDisconnect(false)}>ביטול</Button></div> : <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(true)}>ניתוק</Button>}</SettingRow>
      </>}
      {(message || feedback || connection?.lastError) && <p role="status" className="py-3 text-sm leading-relaxed text-ink-2">{message || MESSAGES[feedback ?? ''] || MESSAGES[connection?.lastError ?? '']}</p>}
      {setupCallback && <p className="py-3 text-sm text-muted">להפעלת החיבור יש לרשום ב־Google Cloud את כתובת החזרה: <code dir="ltr" className="mt-1 block break-all rounded bg-surface-2 p-2 text-xs">{setupCallback}</code></p>}
    </SettingsSection>
    <SettingsSection title="קישור מנוי ליומן" description="אפשר להוסיף את משימות סדר ליומן Google גם באמצעות קישור מנוי. זהו סנכרון חד־כיווני; Google קובעת את קצב הרענון.">
      <SettingRow label="קישור אישי" description="מי שמחזיק בקישור יכול לקרוא את המשימות המתוזמנות שלכם. יצירת קישור חדש מבטלת מיד את הקודם." control="auto"><Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => { try { const result = await createCalendarFeedAction(); setFeedUrl(result.url); setMessage('נוצר קישור חדש. הקישור הקודם בוטל.'); router.refresh(); } catch { setMessage('לא הצלחנו ליצור את הקישור.'); } })}>{feedActive ? 'יצירת קישור חדש' : 'יצירת קישור מנוי'}</Button></SettingRow>
      {feedUrl && <div className="space-y-2 py-4"><label htmlFor="calendar-feed-url" className="text-sm font-semibold text-ink">קישור המנוי שלכם</label><input id="calendar-feed-url" aria-label="קישור המנוי שלכם" readOnly value={feedUrl} dir="ltr" className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink" /><div className="flex flex-wrap items-center gap-2"><Button variant="secondary" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(feedUrl); setMessage('הקישור הועתק.'); } catch { setMessage('אפשר לסמן ולהעתיק את הקישור מהשדה.'); } }}><Copy className="size-3.5" aria-hidden />העתקת קישור</Button><a href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-accent">פתיחת Google Calendar<ExternalLink className="size-3.5" aria-hidden /></a></div><p className="text-xs text-muted">ב־Google Calendar בוחרים ״יומנים אחרים״ ← ״מכתובת URL״ ומדביקים את הקישור. הקישור מוצג כאן רק לאחר יצירתו.</p></div>}
      {feedActive && <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(async () => { const result = await revokeCalendarFeedAction(); setFeedUrl(null); return result; }, 'קישור המנוי בוטל.')}>ביטול קישור המנוי</Button>}
    </SettingsSection>
  </>;
}
