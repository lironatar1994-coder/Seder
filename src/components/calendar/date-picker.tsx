'use client';

import { useState } from 'react';
import { CalendarX2, ChevronLeft, ChevronRight, Clock, Layers, Moon, Sun, CalendarDays } from 'lucide-react';
import { TimePickerPanel } from './time-picker';
import { cn } from '@/lib/cn';
import { buildMonthGrid, WEEKDAY_HEADERS, parseISODay } from '@/lib/calendar';
import { addDays, today, weekdayName, formatShortDate } from '@/lib/dates';
import { hebrewDayMonth } from '@/lib/hebrew-date';
import type { WhenBucket } from '@/lib/constants';

export interface WhenValue {
  bucket: WhenBucket;
  date?: string | null;
  time?: string | null;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * The date picker, after Things': the answers you actually want are one tap
 * away at the top, and the grid is there for the rarer specific day.
 *
 * `variant="deadline"` drops the bucket rows and the time field — a deadline is
 * a date or nothing, never "sometime".
 */
export function DatePickerPanel({
  value,
  bucket,
  time,
  variant = 'schedule',
  onPick,
  onClear,
}: {
  value: string | null;
  bucket?: WhenBucket;
  time?: string | null;
  variant?: 'schedule' | 'deadline';
  onPick: (value: WhenValue) => void;
  onClear: () => void;
}) {
  const base = today();
  const [anchor, setAnchor] = useState<Date>(value ? parseISODay(value) : base);
  const [timeOpen, setTimeOpen] = useState(false);
  const grid = buildMonthGrid(anchor, base);

  const tomorrow = addDays(base, 1);
  // The Israeli week starts on Sunday, so "next week" is the coming Sunday.
  const nextWeek = addDays(base, (0 - base.getUTCDay() + 7) % 7 || 7);

  const isSchedule = variant === 'schedule';
  const selected = value;

  const quick = isSchedule
    ? [
        { key: 'today', icon: Sun, label: 'היום', hint: null, value: { bucket: 'SCHEDULED' as const, date: iso(base) } },
        { key: 'tomorrow', icon: CalendarDays, label: 'מחר', hint: weekdayName(tomorrow), value: { bucket: 'SCHEDULED' as const, date: iso(tomorrow) } },
        { key: 'next', icon: CalendarDays, label: 'שבוע הבא', hint: formatShortDate(nextWeek), value: { bucket: 'SCHEDULED' as const, date: iso(nextWeek) } },
        { key: 'anytime', icon: Layers, label: 'בכל עת', hint: null, value: { bucket: 'ANYTIME' as const } },
        { key: 'someday', icon: Moon, label: 'מתישהו', hint: null, value: { bucket: 'SOMEDAY' as const } },
      ]
    : [
        { key: 'today', icon: Sun, label: 'היום', hint: null, value: { bucket: 'SCHEDULED' as const, date: iso(base) } },
        { key: 'tomorrow', icon: CalendarDays, label: 'מחר', hint: weekdayName(tomorrow), value: { bucket: 'SCHEDULED' as const, date: iso(tomorrow) } },
        { key: 'next', icon: CalendarDays, label: 'שבוע הבא', hint: formatShortDate(nextWeek), value: { bucket: 'SCHEDULED' as const, date: iso(nextWeek) } },
      ];

  if (isSchedule && timeOpen && selected) return (
    <div className="w-72" data-testid="date-picker" data-variant={variant}>
      <button type="button" onClick={() => setTimeOpen(false)} className="mb-3 flex h-11 items-center gap-2 text-sm text-ink-2">
        <ChevronRight className="size-4" aria-hidden />תאריך
      </button>
      <TimePickerPanel time={time}
        onSave={nextTime => onPick({ bucket: 'SCHEDULED', date: selected, time: nextTime })}
        onRemove={() => onPick({ bucket: 'SCHEDULED', date: selected, time: null })} />
    </div>
  );

  return (
    <div className="w-72" data-testid="date-picker" data-variant={variant}>
      <ul className="space-y-0.5">
        {quick.map((option) => {
          const Icon = option.icon;
          const active =
            option.value.bucket === 'SCHEDULED'
              ? selected === option.value.date
              : bucket === option.value.bucket;
          return (
            <li key={option.key}>
              <button
                type="button"
                onClick={() => onPick({ ...option.value, time })}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2 py-1 text-start text-sm transition-colors',
                  active ? 'bg-accent-soft font-semibold text-accent' : 'text-ink hover:bg-surface-2',
                )}
              >
                <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="flex-1">{option.label}</span>
                {option.hint && <span className="num text-xs text-muted">{option.hint}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="my-1.5 h-px bg-line" />

      <div className="mb-1 flex items-center justify-between">
        <p className="display text-sm font-bold text-ink">
          {grid.gregorianMonth} <span className="num font-normal text-muted">{grid.gregorianYear}</span>
        </p>
        <div className="flex items-center gap-0.5">
          {/* Earlier is toward the start of the line: right, in Hebrew. */}
          <MiniNav label="לחודש הקודם" onClick={() => setAnchor(parseISODay(`${grid.prevAnchor}-01`))}>
            <ChevronRight className="size-3.5" aria-hidden />
          </MiniNav>
          <MiniNav label="לחודש הבא" onClick={() => setAnchor(parseISODay(`${grid.nextAnchor}-01`))}>
            <ChevronLeft className="size-3.5" aria-hidden />
          </MiniNav>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_HEADERS.map((label, index) => (
          <div
            key={label}
            className={cn(
              'pb-1 text-center text-xs font-semibold',
              index >= 5 ? 'text-line-strong' : 'text-muted',
            )}
          >
            {label}
          </div>
        ))}

        {grid.days.map((day) => {
          const active = selected === day.iso;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onPick({ bucket: 'SCHEDULED', date: day.iso, time })}
              aria-current={active ? 'date' : undefined}
              className={cn(
                // A fixed height rather than aspect-square: six square rows in
                // a 288px popover push the time field and the clear button
                // below the fold on a laptop.
                'num grid h-7 place-items-center rounded-md text-xs transition-colors',
                !day.inMonth && 'text-line-strong',
                day.inMonth && !active && 'text-ink hover:bg-surface-2',
                day.isWeekend && day.inMonth && !active && 'text-muted',
                day.isToday && !active && 'font-bold text-accent',
                active && 'bg-accent font-bold text-[var(--on-accent)]',
              )}
            >
              {day.dayOfMonth}
            </button>
          );
        })}
      </div>

      {isSchedule && (
        <button type="button" disabled={!selected} onClick={() => setTimeOpen(true)}
          className="mt-2 flex min-h-11 w-full items-center gap-2 border-bs border-line px-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-50">
          <Clock className="size-4" aria-hidden />
          {time ? <span dir="ltr" className="num">{time}</span> : 'הוספת שעה'}
        </button>
      )}

      {/* The Hebrew reading of whatever is selected — the same dual-calendar
          habit as the day header, so the two never disagree. */}
      <div className="mt-2 flex items-center justify-between gap-2 border-bs border-line pt-2">
        <p className="min-w-0 truncate text-xs text-muted">
          {selected ? (
            <>
              <span className="display text-ink-2">{hebrewDayMonth(parseISODay(selected))}</span>
              {' · '}
              <span className="num">{formatShortDate(parseISODay(selected))}</span>
            </>
          ) : (
            'לא נבחר תאריך'
          )}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <CalendarX2 className="size-3.5" aria-hidden />
          ניקוי
        </button>
      </div>
    </div>
  );
}

function MiniNav({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  );
}
