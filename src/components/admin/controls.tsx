'use client';

import { useEffect, useRef, useState, useTransition, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, Search } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import { changePasswordAction, type SettingsState } from '@/server/settings/actions';
import { requestWhatsappPairingAction } from '@/server/settings/whatsapp';
import styles from '@/app/admin/admin.module.css';

export function AdminRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || document.activeElement?.matches('input')) return;
      startTransition(() => router.refresh());
    }, 60_000);
    return () => clearInterval(timer);
  }, [router]);
  return <IconButton label="רענון הנתונים" disabled={pending} onClick={() => startTransition(() => router.refresh())} className={styles.iconButton}>
    <RefreshCw size={18} aria-hidden className={pending ? styles.refreshing : undefined} />
  </IconButton>;
}

export function AdminSearch({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [input, setInput] = useState(value);
  const [, startTransition] = useTransition();
  const current = params.toString();
  useEffect(() => setInput(value), [value]);
  useEffect(() => {
    if (input.trim() === value) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(current);
      if (input.trim()) next.set('q', input.trim().slice(0, 100)); else next.delete('q');
      next.delete('page');
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(timer);
  }, [input, value, current, pathname, router]);
  return <div className={styles.search}>
    <Search size={17} aria-hidden />
    <input aria-label="חיפוש משתמשים לפי שם או אימייל" type="search" dir="auto" value={input} onChange={(event) => setInput(event.target.value)} placeholder="שם או אימייל" maxLength={100} />
  </div>;
}

function PasswordSubmit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'מעדכנים…' : 'עדכון סיסמה'}</Button>;
}

export function AdminPassword() {
  const [state, action] = useActionState<SettingsState, FormData>(changePasswordAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.saved) form.current?.reset(); }, [state]);
  const fields = [{ name: 'current', label: 'סיסמה נוכחית' }, { name: 'next', label: 'סיסמה חדשה' }, { name: 'confirm', label: 'אימות סיסמה חדשה' }];
  return <form ref={form} action={action} className={styles.passwordForm}>
    {fields.map((field) => <div key={field.name}>
      <Label htmlFor={`admin-password-${field.name}`}>{field.label}</Label>
      <Input id={`admin-password-${field.name}`} name={field.name} type="password" dir="auto" required minLength={field.name === 'current' ? 1 : 8} maxLength={200} autoComplete={field.name === 'current' ? 'current-password' : 'new-password'} aria-invalid={Boolean(state.errors?.[field.name])} aria-describedby={state.errors?.[field.name] ? `admin-${field.name}-error` : undefined} />
      <FieldError id={`admin-${field.name}-error`}>{state.errors?.[field.name]}</FieldError>
    </div>)}
    <div className={styles.passwordSubmit}><PasswordSubmit />{state.saved && <span role="status">הסיסמה עודכנה</span>}</div>
    {state.errors?._ && <p role="alert">{state.errors._}</p>}
  </form>;
}

export function AdminPairing({ status, stale, qr }: { status: string; stale: boolean; qr: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  useEffect(() => {
    if (stale || !['NEEDS_SCAN', 'INITIALIZING'].includes(status)) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 10_000);
    return () => clearInterval(timer);
  }, [status, stale, router]);
  if (stale || status === 'OFFLINE' || status === 'READY') return null;
  if (qr && status === 'NEEDS_SCAN') return <div className={styles.pairing}>
    {/* A rotating, server-produced QR. No remote image source or cached optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={qr} alt="קוד לסריקה באפליקציית וואטסאפ, מכשירים מקושרים" width={180} height={180} />
    <span>סריקה דרך מכשירים מקושרים</span>
  </div>;
  if (status === 'INITIALIZING' || status === 'NEEDS_SCAN') return null;
  return <div className={styles.pairing}>
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => startTransition(async () => {
      setError('');
      try {
        const result = await requestWhatsappPairingAction();
        if (result.errors) setError(result.errors.pairing ?? 'לא הצלחנו להתחיל את החיבור');
        router.refresh();
      } catch { setError('החיבור לא התחיל. אפשר לנסות שוב.'); }
    })}>{pending ? 'מתחברים…' : 'חיבור מכשיר'}</Button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
