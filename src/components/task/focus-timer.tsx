'use client';
import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';

const LENGTH = 25 * 60;
export function FocusTimer() {
  const [remaining, setRemaining] = useState(LENGTH);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { try { const saved = JSON.parse(sessionStorage.getItem('seder-focus') ?? 'null'); if (saved && typeof saved.remaining === 'number') { setRemaining(Math.min(LENGTH, Math.max(0, saved.remaining))); if (typeof saved.endsAt === 'number' && saved.endsAt > Date.now()) setEndsAt(saved.endsAt); } } catch {} setReady(true); }, []);
  useEffect(() => { if (ready) sessionStorage.setItem('seder-focus', JSON.stringify({ remaining, endsAt })); }, [remaining, endsAt, ready]);
  useEffect(() => { if (!endsAt) return; const tick = () => { const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)); setRemaining(left); if (!left) setEndsAt(null); }; tick(); const interval = setInterval(tick, 1000); return () => clearInterval(interval); }, [endsAt]);
  return <section className="focus-session" aria-label="זמן למיקוד">
    <div className="flex items-center gap-2 text-sm font-semibold"><Timer className="size-4" aria-hidden />זמן למיקוד</div>
    <p className="mt-1 text-sm text-muted">משימה אחת. 25 דקות בלי פיזור.</p>
    <div className="my-4 flex items-baseline gap-3"><span className="num text-[2.75rem] font-medium leading-none" aria-label={`${Math.floor(remaining / 60)} דקות ו־${remaining % 60} שניות`}>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span><span className="text-xs text-muted">{endsAt ? 'במיקוד' : remaining === 0 ? 'הסבב הושלם' : 'בקצב שלכם'}</span></div>
    <div className="flex items-center gap-2"><Button size="sm" variant="secondary" disabled={!ready} onClick={() => { if (endsAt) { setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))); setEndsAt(null); } else { const seconds = remaining || LENGTH; setRemaining(seconds); setEndsAt(Date.now() + seconds * 1000); } }}>{endsAt ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}{endsAt ? 'השהיה' : remaining === LENGTH || remaining === 0 ? 'התחלת מיקוד' : 'המשך'}</Button><IconButton label="איפוס זמן המיקוד" onClick={() => { setEndsAt(null); setRemaining(LENGTH); }}><RotateCcw className="size-3.5" aria-hidden /></IconButton></div>
    {remaining === 0 && <p role="status" className="mt-3 text-sm font-semibold text-accent">הגיע הזמן להפסקה קצרה.</p>}
  </section>;
}
