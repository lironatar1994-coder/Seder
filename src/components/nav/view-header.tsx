import { buildLockup } from '@/lib/hebrew-date';
import { today } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { RollingNumber } from '@/components/ui/rolling-number';

/**
 * The signature element.
 *
 * Israelis read two calendars every day — the Gregorian date to schedule by and
 * the Hebrew date for everything cultural — so the header carries both, set in
 * the serif display face against tabular numerals. Under it runs the day rail:
 * a hairline that fills as today's tasks close. The rail is not decoration, it
 * is the only place in the app that answers "how much of today is left".
 */
export function ViewHeader({
  title,
  subtitle,
  accent,
  progress,
  showDate = false,
  action,
}: {
  title: string;
  subtitle?: string | null;
  accent?: string;
  progress?: { done: number; total: number };
  showDate?: boolean;
  action?: React.ReactNode;
}) {
  const lockup = showDate ? buildLockup(today()) : null;

  // The lockup is the signature and also the most expensive thing on the page.
  // At 1280px it costs a corner; at 390px it was costing five rows of the only
  // screen a phone has. It keeps its authority on the phone by staying the
  // largest thing there — just not by the same absolute measure.
  return (
    <header className="pb-4 pt-5 md:pb-5 md:pt-8">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {lockup ? (
            <>
              <h1 className="display text-[2rem] font-bold leading-none text-ink md:text-5xl">
                {lockup.weekday}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-muted md:mt-2">
                {lockup.hebrew && (
                  <span className="display text-base text-ink-2 md:text-lg">{lockup.hebrew}</span>
                )}
                {lockup.hebrew && (
                  <span aria-hidden className="text-line-strong">
                    ·
                  </span>
                )}
                <span className="num text-base tracking-tight text-ink-2 md:text-lg">
                  {lockup.gregorian}
                </span>
              </p>
            </>
          ) : (
            <h1
              className="display truncate text-4xl font-bold leading-tight text-ink"
              style={accent ? { color: accent } : undefined}
            >
              {title}
            </h1>
          )}
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>

      {progress && progress.total > 0 && <DayRail {...progress} />}
    </header>
  );
}

/** A hairline that fills from the inline-start — right to left in Hebrew,
 *  following the reading direction — with a tick per remaining task. */
function DayRail({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = done === total;

  return (
    <div className="mt-3.5 md:mt-5">
      <div
        className="relative h-0.5 w-full rounded-full bg-line-strong"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`הושלמו ${done} מתוך ${total} משימות היום`}
      >
        {/* inset-inline-start pins the fill to the reading-start edge, so it
            grows right→left in Hebrew without any direction check. */}
        <div
          className="absolute inset-bs-0 inset-s-0 h-0.5 rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `${pct}%` }}
        />
        {pct > 0 && pct < 100 && (
          <span
            aria-hidden
            className="absolute inset-bs-[-3px] size-2 -translate-x-1/2 rounded-full bg-accent ring-2 ring-[var(--paper)] rtl:translate-x-1/2"
            style={{ insetInlineStart: `${pct}%` }}
          />
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted md:mt-2">
        {complete ? (
          <span className="font-semibold text-accent">הכול סגור להיום.</span>
        ) : (
          <>
            <RollingNumber value={done} />
            {' מתוך '}
            <span className="num">{total}</span>
            {' הושלמו'}
          </>
        )}
      </p>
    </div>
  );
}
