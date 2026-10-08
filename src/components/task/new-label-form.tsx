'use client';
import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createLabelAction } from '@/server/organization/actions';
import { SWATCHES, SWATCH_LABELS } from '@/lib/constants';
import { Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export function NewLabelForm() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  return <><button type="button" className="directory-create" aria-expanded={open} aria-controls={id} onClick={() => { setOpen(!open); setError(''); }}><Plus className="size-4" aria-hidden />תווית חדשה</button>{open && <form id={id} className="directory-inline-form" onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setError('');
    start(async () => { const result = await createLabelAction({ name: data.get('name'), color: data.get('color') }); if (!result.ok) { setError(result.error ?? 'התווית לא נוצרה. אפשר לנסות שוב.'); return; } setOpen(false); router.refresh(); toast({ message: 'התווית נוספה' }); });
  }}><label className="filter-field">שם התווית<Input name="name" required maxLength={40} aria-describedby={`${id}-name-hint`} autoFocus placeholder="למשל: טלפון" /></label><p id={`${id}-name-hint`} className="text-sm text-muted">ללא רווחים או הסימנים @ ו־#</p><label className="filter-field">צבע<select aria-label="צבע" name="color" defaultValue="slate">{SWATCHES.map(color => <option key={color} value={color}>{SWATCH_LABELS[color]}</option>)}</select></label>{error && <p role="alert" className="text-sm text-p1">{error}</p>}<div className="flex gap-2"><Button type="submit" size="sm" disabled={pending}>{pending ? 'יוצרים…' : 'יצירת תווית'}</Button><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>ביטול</Button></div></form>}</>;
}
