import { CircleCheck } from 'lucide-react';
import { buildLockup } from '@/lib/hebrew-date';
import { today } from '@/lib/dates';

export function ViewHeader({ title, subtitle, accent, progress, showDate = false, count, countOnly = false, action }: {
  title: string;
  subtitle?: string | null;
  accent?: string;
  progress?: { done: number; total: number };
  showDate?: boolean;
  /** Open tasks in the view, shown after the date as Todoist does. */
  count?: number;
  /** Show the count in place of the subtitle (Inbox). */
  countOnly?: boolean;
  action?: React.ReactNode;
}) {
  const lockup = showDate ? buildLockup(today()) : null;
  return (
    <header className="view-heading">
      <div className="flex min-w-0 items-center justify-between gap-3">
        {/* Ink, as Todoist titles a project; the colour stays on its # in the sidebar. */}
        <h1 className="min-w-0 break-words text-[1.75rem] font-bold leading-tight text-ink md:text-[2rem]" data-accent-color={accent || undefined}>{title}</h1>
        <div className="flex shrink-0 items-center gap-0.5">{action}<span data-list-controls-host className="contents" /></div>
      </div>
      {lockup ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          {count !== undefined && count > 0 && <><span className="inline-flex items-center gap-1.5 text-ink-2"><CircleCheck className="size-3.5" aria-hidden />{count === 1 ? 'משימה אחת' : <><span className="num">{count}</span> משימות</>}</span><span aria-hidden className="mx-1 text-line-strong">|</span></>}
          <span>{lockup.weekday}</span><span aria-hidden>·</span>
          <span className="num">{lockup.gregorian}</span>
          {lockup.hebrew && <><span aria-hidden>·</span><span>{lockup.hebrew}</span></>}
          {progress && progress.done > 0 && <span className="ms-auto text-xs" aria-label={`הושלמו ${progress.done} מתוך ${progress.total} משימות היום`}>{progress.done} הושלמו</span>}
        </p>
      ) : countOnly && count ? (
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-ink-2" title={subtitle ?? undefined}><CircleCheck className="size-3.5" aria-hidden />{count === 1 ? 'משימה אחת' : <><span className="num">{count}</span> משימות</>}</p>
      ) : subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </header>
  );
}
