'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { WEEKDAY_SHORT } from '@/lib/dates';
import { ALL_WEEKDAYS, PERIOD_LABELS, TRACKER_PERIODS, WORK_WEEK, type TrackerPeriod } from '@/lib/tracker';
import { Button } from '@/components/ui/button';

export interface TrackerSettings {
  name: string;
  period: TrackerPeriod;
  weekdays: number[];
}

/**
 * Name, span and days — the whole definition of a habit table, edited in
 * place. The same form opens a new table and reshapes an existing one, so
 * there is one place to learn it.
 */
export function TrackerForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  extra,
}: {
  initial?: TrackerSettings;
  submitLabel: string;
  onSubmit: (settings: TrackerSettings) => void;
  onCancel: () => void;
  extra?: React.ReactNode;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [period, setPeriod] = useState<TrackerPeriod>(initial?.period ?? 'WEEK');
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? [...ALL_WEEKDAYS]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  function toggleDay(day: number) {
    setWeekdays((current) => {
      if (current.includes(day)) return current.length === 1 ? current : current.filter((d) => d !== day);
      return [...current, day].sort((a, b) => a - b);
    });
  }

  const same = (a: readonly number[]) => a.length === weekdays.length && a.every((d) => weekdays.includes(d));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name: name.trim() || 'מעקב יומי', period, weekdays });
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
      className="space-y-4"
    >
      <input
        ref={input}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={80}
        placeholder="שם הטבלה, למשל: הרגלים יומיים"
        aria-label="שם הטבלה"
        className="w-full bg-transparent text-xl font-bold text-ink outline-none placeholder:font-semibold placeholder:text-muted"
      />

      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink-2">מה הטבלה מציגה</p>
        <div role="radiogroup" aria-label="טווח הטבלה" className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
          {TRACKER_PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={period === option}
              onClick={() => setPeriod(option)}
              className={cn(
                'min-h-10 rounded-lg text-sm font-semibold transition-[background-color,color,box-shadow] duration-200',
                period === option ? 'bg-surface text-ink shadow-row' : 'text-muted hover:text-ink',
              )}
            >
              {PERIOD_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink-2">באילו ימים</p>
          <div className="flex gap-1.5 text-xs font-semibold">
            <Preset active={same(ALL_WEEKDAYS)} onClick={() => setWeekdays([...ALL_WEEKDAYS])}>
              כל השבוע
            </Preset>
            <Preset active={same(WORK_WEEK)} onClick={() => setWeekdays([...WORK_WEEK])}>
              א׳–ה׳
            </Preset>
          </div>
        </div>
        <div role="group" aria-label="ימים בטבלה" className="flex gap-1.5">
          {ALL_WEEKDAYS.map((day) => {
            const on = weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][day]}
                onClick={() => toggleDay(day)}
                className={cn(
                  'relative grid h-11 flex-1 place-items-center rounded-xl border text-sm font-bold transition-all duration-200 active:scale-95',
                  on ? 'border-accent bg-accent text-[var(--on-accent)] shadow-row' : 'border-line-strong bg-surface text-muted hover:border-accent/50 hover:text-ink',
                )}
              >
                {WEEKDAY_SHORT[day]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" size="sm">
          <Check className="size-4" aria-hidden />
          {submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          ביטול
        </Button>
        {extra && <div className="ms-auto">{extra}</div>}
      </div>
    </form>
  );
}

function Preset({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-full px-2.5 py-1 transition-colors', active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink')}
    >
      {children}
    </button>
  );
}
