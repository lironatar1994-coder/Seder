'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, MoreHorizontal } from 'lucide-react';
import { COMPOSER_FIELDS, DEFAULT_COMPOSER_PREFERENCES, type ComposerPreferences } from '@/lib/composer-preferences';
import { COMPOSER_FIELD_DETAILS } from '@/components/task/composer-fields';
import { useComposerPreferences } from '@/components/task/composer-preferences';
import { updateComposerPreferencesAction } from '@/server/settings/actions';
import { Button } from '@/components/ui/button';
import { SettingsSection, SettingRow, SavedNote } from './shell';

export function QuickAddForm() {
  const persisted = useComposerPreferences();
  const [value, setValue] = useState<ComposerPreferences>(persisted);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(value) !== JSON.stringify(persisted);
  const ordered = [...value.fields, ...COMPOSER_FIELDS.filter(field => !value.fields.includes(field))];

  function change(next: ComposerPreferences) { setValue(next); setSaved(false); setError(''); }
  function move(index: number, delta: number) {
    const fields = [...value.fields];
    [fields[index], fields[index + delta]] = [fields[index + delta], fields[index]];
    change({ ...value, fields });
  }
  function save() {
    startTransition(async () => {
      try {
        const result = await updateComposerPreferencesAction(value);
        if (result.errors) { setError(result.errors.composer); return; }
        setSaved(true);
      } catch { setError('השינויים לא נשמרו. נסו שוב.'); }
    });
  }

  return <SettingsSection title="הוספת משימה" description="בחרו מה להציג ובאיזה סדר. שדות מוסתרים זמינים דרך ״עוד״." hideTitle>
    <div className="py-4" data-testid="composer-preview">
      <p className="mb-2 text-sm font-semibold text-ink">תצוגה מקדימה</p>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-3" aria-label="שדות בהוספת משימה">
        {value.fields.map(field => { const { label, icon: Icon } = COMPOSER_FIELD_DETAILS[field]; return <span key={field} title={label} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm text-ink-2"><Icon className="size-4" aria-hidden />{value.showLabels && label}</span>; })}
        <span title="עוד" className="inline-flex h-9 items-center gap-1.5 px-2 text-sm text-ink-2"><MoreHorizontal className="size-4" aria-hidden />{value.showLabels && 'עוד'}</span>
      </div>
    </div>
    <SettingRow label="שמות השדות" htmlFor="composer-show-labels" control="auto">
      <input id="composer-show-labels" type="checkbox" checked={value.showLabels} disabled={pending} onChange={event => change({ ...value, showLabels: event.target.checked })} className="size-5 accent-[var(--accent)]" />
    </SettingRow>
    <fieldset disabled={pending} className="border-be border-line">
      <legend className="sr-only">שדות וסדר תצוגה</legend>
      {ordered.map(field => {
        const { label, icon: Icon } = COMPOSER_FIELD_DETAILS[field];
        const index = value.fields.indexOf(field);
        const visible = index >= 0;
        return <div key={field} className="flex min-h-14 items-center gap-2 border-be border-line last:border-0" data-field={field}>
          <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
            <input type="checkbox" aria-label={`הצגת ${label}`} checked={visible} onChange={() => change({ ...value, fields: visible ? value.fields.filter(item => item !== field) : [...value.fields, field] })} className="size-5 shrink-0 accent-[var(--accent)]" />
            <Icon className="size-4 shrink-0 text-muted" aria-hidden /><span className="text-sm text-ink">{label}</span>
          </label>
          {visible && <div className="flex shrink-0">
            <button type="button" aria-label={`הקדמת ${label}`} disabled={index === 0 || pending} onClick={() => move(index, -1)} className="grid size-11 place-items-center rounded-md text-ink-2 hover:bg-surface-2 disabled:opacity-30"><ArrowUp className="size-4" aria-hidden /></button>
            <button type="button" aria-label={`הזזת ${label} לאחר הבא`} disabled={index === value.fields.length - 1 || pending} onClick={() => move(index, 1)} className="grid size-11 place-items-center rounded-md text-ink-2 hover:bg-surface-2 disabled:opacity-30"><ArrowDown className="size-4" aria-hidden /></button>
          </div>}
        </div>;
      })}
    </fieldset>
    <div className="flex flex-wrap items-center gap-3 pt-5">
      <Button size="sm" disabled={pending || !dirty} onClick={save} aria-busy={pending}>שמירת שינויים</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => change({ ...DEFAULT_COMPOSER_PREFERENCES, fields: [...COMPOSER_FIELDS] })}>ברירת מחדל</Button>
      <SavedNote show={saved} />
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-p1">{error}</p>}
  </SettingsSection>;
}
