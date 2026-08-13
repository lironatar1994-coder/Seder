'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { VIEWS } from '@/lib/constants';
import {
  ACCENTS,
  applyAccent,
  applyMode,
  readAccent,
  readMode,
  type Accent,
  type ThemeMode,
} from '@/components/nav/theme';
import { updateDefaultViewAction } from '@/server/settings/actions';
import { useToast } from '@/components/ui/toast';
import { SettingRow, SettingsSection, SavedNote } from './shell';

const MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'מערכת', icon: Monitor },
  { value: 'light', label: 'בהיר', icon: Sun },
  { value: 'dark', label: 'כהה', icon: Moon },
];

export function AppearanceForm({ defaultView }: { defaultView: string }) {
  const [mode, setMode] = useState<ThemeMode | null>(null);
  const [accent, setAccent] = useState<Accent | null>(null);
  const [view, setView] = useState(defaultView);
  const [savedView, setSavedView] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  // Read after mount: the server cannot know what the inline bootstrap picked.
  useEffect(() => {
    setMode(readMode());
    setAccent(readAccent());
  }, []);

  function chooseMode(next: ThemeMode) {
    applyMode(next);
    setMode(next);
  }

  function chooseAccent(next: Accent) {
    applyAccent(next);
    setAccent(next);
  }

  function chooseView(slug: string) {
    setView(slug);
    setSavedView(false);
    startTransition(async () => {
      const result = await updateDefaultViewAction(slug);
      if (result.errors) {
        setView(defaultView);
        toast({ message: result.errors.defaultView ?? 'ההגדרה לא נשמרה', tone: 'error' });
        return;
      }
      setSavedView(true);
    });
  }

  return (
    <SettingsSection title="מראה" hideTitle>
      <SettingRow
        label="בהירות"
        description="״מערכת״ עוקב אחרי ההגדרה של המכשיר ומתחלף יחד איתה."
        align="start"
      >
        {/* A segmented control rather than a dropdown: three options that are
            cheap to compare, and the choice applies the moment it is made. */}
        <div
          role="radiogroup"
          aria-label="בהירות"
          className="flex rounded-lg border border-line-strong p-0.5"
        >
          {MODES.map((option) => {
            const Icon = option.icon;
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseMode(option.value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors duration-150',
                  active
                    ? 'bg-accent-soft font-semibold text-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
      </SettingRow>

      <SettingRow
        label="צבע ראשי"
        description="הצבע שנושא מצב, מיקוד והשלמה. עובד בשתי רמות הבהירות."
        align="start"
        control="auto"
      >
        {/* Swatches, not a dropdown: the thing being chosen is the colour, so
            the colour has to be what you click. Each carries its name for
            anyone who cannot tell them apart by hue alone. */}
        <div role="radiogroup" aria-label="צבע ראשי" className="flex flex-wrap gap-2">
          {ACCENTS.map((option) => {
            const active = accent === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={option.label}
                title={option.label}
                // `data-accent` sets the hue axis on this element, and
                // `.accent-swatch` re-derives the colour from it — the
                // inherited `--accent` was already resolved on :root and would
                // show the current theme, not this option.
                data-accent={option.value}
                onClick={() => chooseAccent(option.value)}
                className={cn(
                  'accent-swatch relative grid size-9 place-items-center rounded-full',
                  'transition-shadow duration-150 ring-offset-2 ring-offset-[var(--surface)]',
                  active ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-line-strong',
                )}
              >
                {active && (
                  <Check
                    className="size-4 text-[var(--on-accent)]"
                    strokeWidth={3}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </SettingRow>

      <SettingRow
        label="תצוגת פתיחה"
        description="המסך שנפתח כשנכנסים לאפליקציה."
        htmlFor="default-view"
      >
        <div className="flex items-center gap-2">
          <select
            id="default-view"
            value={view}
            disabled={pending}
            onChange={(event) => chooseView(event.target.value)}
            className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-colors hover:border-muted focus:border-accent disabled:opacity-60"
          >
            {VIEWS.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </select>
          <SavedNote show={savedView} />
        </div>
      </SettingRow>
    </SettingsSection>
  );
}
