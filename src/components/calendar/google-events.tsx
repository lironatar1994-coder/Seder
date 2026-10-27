'use client';

import { useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, ExternalLink, RefreshCw } from 'lucide-react';
import type { GoogleEventDTO } from '@/lib/calendar-event-types';
import { syncGoogleAction } from '@/server/google/actions';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

const time = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function GoogleEventRow({ event, compact = false }: { event: GoogleEventDTO; compact?: boolean }) {
  const content = <><CalendarDays className="size-3.5 shrink-0 text-accent" aria-hidden />
    <span className="num shrink-0 text-xs text-muted">{event.allDay ? 'כל היום' : time.format(new Date(event.startAt))}</span>
    <span dir="auto" className="min-w-0 flex-1 truncate">{event.title}</span>
    {!compact && <ExternalLink className="size-3 shrink-0 text-muted" aria-hidden />}</>;
  const className = cn('flex min-w-0 items-center gap-1.5 rounded-md border-s-2 border-accent/50 bg-accent-soft/40 px-2 py-1.5 text-start text-sm text-ink-2', compact && 'py-1 text-xs', event.htmlLink && 'hover:bg-accent-soft');
  return event.htmlLink ? <a data-testid="google-event" href={event.htmlLink} target="_blank" rel="noopener noreferrer" className={className} title={`${event.title} · ${event.calendar}${event.location ? ` · ${event.location}` : ''}`} aria-label={`${event.title}, ${event.allDay ? 'כל היום' : time.format(new Date(event.startAt))}, פתיחה ביומן Google`}>{content}</a> : <div data-testid="google-event" className={className}>{content}</div>;
}
/** Syncs now, reporting a failure the way the bar always did. */
export function useGoogleSync() {
  const [pending, start] = useTransition(); const router = useRouter(); const { toast } = useToast();
  const sync = () => start(async () => { const result = await syncGoogleAction(); if (!result.ok) toast({ tone: 'error', message: result.error === 'BUSY' ? 'הסנכרון כבר מתבצע. אפשר לנסות בעוד רגע.' : 'הסנכרון לא הושלם. אפשר לבדוק את החיבור בהגדרות.' }); else toast({ message: 'יומן Google סונכרן', group: 'google-sync' }); router.refresh(); });
  return { pending, sync };
}

/* `quiet` (Today): Todoist shows no status row above the list, so a healthy
   connection only keeps refreshing in the background; the sync itself lives
   in the view's "…" menu. A problem still gets its line. */
export function GoogleSyncBar({ connected, lastError, quiet = false }: { connected: boolean; lastError?: string | null; quiet?: boolean }) {
  const [pending, start] = useTransition(); const router = useRouter(); const { toast } = useToast();
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 60_000);
    return () => clearInterval(timer);
  }, [connected, router]);
  if (quiet) return lastError ? <Link href="/app/settings/calendar" className="mb-3 block text-xs text-p1 hover:underline">יש לבדוק את החיבור ליומן Google. המידע המוצג הוא מהסנכרון האחרון.</Link> : null;
  return <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
    <CalendarDays className="size-3.5" aria-hidden />
    <Link href="/app/settings/calendar" className="hover:text-ink hover:underline">{connected ? 'יומן Google' : 'חיבור יומן Google'}</Link>
    {connected && <button type="button" disabled={pending} title="סנכרון עכשיו" onClick={() => start(async () => { const result = await syncGoogleAction(); if (!result.ok) toast({ tone: 'error', message: result.error === 'BUSY' ? 'הסנכרון כבר מתבצע. אפשר לנסות בעוד רגע.' : 'הסנכרון לא הושלם. אפשר לבדוק את החיבור בהגדרות.' }); router.refresh(); })} className="grid size-7 place-items-center rounded-md hover:bg-surface-2 hover:text-ink disabled:opacity-50" aria-label="סנכרון יומן Google"><RefreshCw className={cn('size-3.5', pending && 'animate-spin motion-reduce:animate-none')} aria-hidden /></button>}
    {lastError && <Link href="/app/settings/calendar" className="w-full text-p1">יש לבדוק את החיבור ליומן. המידע המוצג הוא מהסנכרון האחרון.</Link>}
  </div>;
}
export function GoogleEventList({ events, showDates = false }: { events: GoogleEventDTO[]; showDates?: boolean }) {
  if (!events.length) return null;
  return <section className="mb-6" aria-label="אירועים מיומן Google"><h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><CalendarDays className="size-4 text-accent" aria-hidden />ביומן Google</h2><ul className="space-y-1.5">{events.map(event => <li key={event.id}>{showDates && <p className="num mb-0.5 text-xs text-muted">{new Intl.DateTimeFormat('he-IL', { timeZone: 'UTC', day: 'numeric', month: 'numeric' }).format(new Date(`${event.startDay}T00:00:00Z`))}</p>}<GoogleEventRow event={event} /></li>)}</ul></section>;
}
