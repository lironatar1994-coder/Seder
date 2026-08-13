import { Flag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { swatchVar } from '@/lib/constants';
import { buildMonthGrid, WEEKDAY_HEADERS } from '@/lib/calendar';
import { today } from '@/lib/dates';

/**
 * The real month grid, this month, built by the same code the app runs.
 *
 * Nothing here is a mockup: the gematria, the Rosh Chodesh label and the
 * Israeli weekend come out of `lib/calendar.ts`, so the page cannot drift from
 * the product and cannot show a month that never existed.
 *
 * One task is placed on it twice — a chip on the day it is planned for, an
 * amber flag on the day it is due — because that pair is the thing the app
 * models and a single "due date" cannot.
 */

const TASK = 'הגשת דוח';
/** Third row, Monday and Wednesday: always inside the month, never the weekend. */
const MARK_WEEK = 2;
const SCHEDULED_COL = 1;
const DEADLINE_COL = 3;

export function MonthPreview() {
  const now = today();
  const grid = buildMonthGrid(now, now);
  const scheduledIso = grid.weeks[MARK_WEEK].days[SCHEDULED_COL].iso;
  const deadlineIso = grid.weeks[MARK_WEEK].days[DEADLINE_COL].iso;

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-row">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2.5">
          <h3 className="display text-base font-bold text-ink">
            {grid.gregorianMonth} <span className="num font-medium">{grid.gregorianYear}</span>
          </h3>
          <p className="truncate text-xs text-muted">{grid.hebrewRange}</p>
        </div>

        {/* `dir="rtl"` on the document puts column 1 on the right by itself, so
            the days stay in plain Sunday-first logical order. */}
        <div className="grid grid-cols-7 border-b border-line bg-surface-2">
          {WEEKDAY_HEADERS.map((label, i) => (
            <div
              key={label}
              className={cn(
                'py-1.5 text-center text-xs font-bold',
                i >= 5 ? 'text-muted' : 'text-ink-2',
              )}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.days.map((day) => (
            <div
              key={day.iso}
              className={cn(
                'flex min-h-14 flex-col gap-1 border-b border-s border-line p-1 md:min-h-20 md:p-1.5',
                day.isWeekend ? 'bg-surface-sunk' : 'bg-surface',
                !day.inMonth && 'opacity-45',
              )}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      'num text-xs leading-none',
                      day.isToday
                        ? 'grid size-5 place-items-center rounded-full bg-accent font-bold text-[var(--on-accent)]'
                        : day.inMonth
                          ? 'font-semibold text-ink'
                          : 'text-muted',
                    )}
                  >
                    {day.dayOfMonth}
                  </span>
                  <span className="text-[0.65rem] leading-none text-muted">{day.hebrewDay}</span>
                </span>

                {day.hebrewMonthLabel && (
                  <span className="truncate text-[0.65rem] font-semibold leading-none text-accent">
                    {day.hebrewMonthLabel}
                  </span>
                )}
              </div>

              {/* A phone gives each day about 45px, which is not enough for a
                  title — a truncated "ה…" is noise. The app answers that with
                  a coloured dot and the day sheet; here the caption carries
                  what the dot means. */}
              {day.iso === scheduledIso && (
                <>
                  <span
                    aria-hidden
                    className="mx-auto size-1.5 shrink-0 rounded-full md:hidden"
                    style={{ backgroundColor: swatchVar('clay') }}
                  />
                  <span className="hidden items-center gap-1 rounded-md bg-surface-2 px-1.5 py-1 text-xs text-ink-2 md:flex">
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: swatchVar('clay') }}
                    />
                    <span className="min-w-0 truncate">{TASK}</span>
                  </span>
                </>
              )}

              {day.iso === deadlineIso && (
                <>
                  <Flag className="mx-auto size-2.5 shrink-0 text-flag md:hidden" aria-hidden />
                  <span className="hidden items-center gap-1 rounded-md border border-flag/35 bg-flag-soft px-1.5 py-1 text-xs text-flag md:flex">
                    <Flag className="size-3 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{TASK}</span>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ backgroundColor: swatchVar('clay') }}
          />
          {TASK} — היום שעובדים עליו
        </span>
        <span className="inline-flex items-center gap-1.5 text-flag">
          <Flag className="size-3" aria-hidden />
          {TASK} — היום שזה חייב להיות מוכן
        </span>
      </figcaption>
    </figure>
  );
}
