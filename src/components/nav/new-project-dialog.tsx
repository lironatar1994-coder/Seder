'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { SWATCHES, SWATCH_LABELS, swatchVar, type Swatch } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/field';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/overlays';
import { createProjectAction } from '@/server/organization/actions';
import { PROJECT_TEMPLATES } from '@/lib/project-templates';

export function NewProjectDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('blank');
  const [color, setColor] = useState<Swatch>('teal');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createProjectAction({ name, color }, template);
      if (!result.ok) {
        setError(result.error ?? 'לא הצלחנו ליצור את הפרויקט');
        return;
      }
      setOpen(false);
      setName('');
      setColor('teal');
      setTemplate('blank');
      if (result.id) router.push(`/app/project/${result.id}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="פרויקט חדש" description="קבוצה של משימות עם מטרה משותפת.">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-name">שם</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: שיפוץ המטבח"
              autoFocus
              aria-invalid={Boolean(error)}
            />
            <FieldError>{error}</FieldError>
          </div>

          <label className="filter-field">נקודת התחלה<select value={template} onChange={(event) => setTemplate(event.target.value)}>{PROJECT_TEMPLATES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="mt-1 text-xs font-normal text-muted">תבנית מוסיפה קטעים לפרויקט. המשימות נשארות בידיים שלכם.</span></label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink-2">צבע</legend>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-pressed={color === swatch}
                  aria-label={SWATCH_LABELS[swatch]}
                  title={SWATCH_LABELS[swatch]}
                  className={cn(
                    'size-7 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-shadow',
                    color === swatch && 'ring-2 ring-ink',
                  )}
                  style={{ backgroundColor: swatchVar(swatch) }}
                />
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? 'יוצרים…' : 'יצירת פרויקט'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
