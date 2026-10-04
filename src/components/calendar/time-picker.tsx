'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';

/** Editing stays local until Save: a native time field emits intermediate values. */
export function TimePickerPanel({ time, onSave, onRemove }: {
  time?: string | null;
  onSave: (time: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(time ?? '');
  return (
    <form className="w-full space-y-3" onSubmit={event => { event.preventDefault(); if (draft) onSave(draft); }}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">שעה</label>
      <input id={id} type="time" dir="ltr" autoFocus required value={draft}
        onChange={event => setDraft(event.target.value)}
        className="num h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink" />
      <div className="flex items-center justify-between gap-2">
        {time ? <Button type="button" variant="ghost" size="sm" onClick={onRemove}>ללא שעה</Button> : <span />}
        <Button type="submit" size="sm" disabled={!draft}>שמור</Button>
      </div>
    </form>
  );
}
