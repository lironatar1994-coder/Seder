import { CalendarDays, Clock, Flag, ListChecks, Repeat } from 'lucide-react';
import { cn } from '@/lib/cn';
import { describeStored } from '@/lib/recurrence';
import { relativeDayLabel, isOverdue, today } from '@/lib/dates';
import { swatchVar, PRIORITY_LABELS, type Priority } from '@/lib/constants';

/** Scheduled day (and time), reading as a person would say it. */
export function WhenChip({
  date,
  time,
  muted,
}: {
  date: Date;
  time?: string | null;
  /** The task is finished. Also suppresses the overdue treatment. */
  muted?: boolean;
}) {
  // A completed task cannot be late. Leaving it red says the opposite of what
  // the tick next to it says.
  const overdue = !muted && isOverdue(date);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        overdue ? 'font-semibold text-p1' : muted ? 'text-muted' : 'text-ink-2',
      )}
    >
      <CalendarDays className="size-3.5 shrink-0" aria-hidden />
      {relativeDayLabel(date, today())}
      {time && (
        <>
          <Clock className="ms-0.5 size-3 shrink-0" aria-hidden />
          {/* A time is an LTR island — without isolation the colon can jump. */}
          <span className="num">{time}</span>
        </>
      )}
    </span>
  );
}

/** Deadline. Amber is reserved for this and for overdue — nothing else in the
 *  interface uses it, so the colour always means "time pressure". */
export function DeadlineChip({ date, muted }: { date: Date; muted?: boolean }) {
  const overdue = !muted && isOverdue(date);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1 text-xs font-semibold',
        muted
          ? 'bg-surface-2 text-muted'
          : overdue
            ? 'bg-p1/10 text-p1'
            : 'bg-flag-soft text-flag',
      )}
      title={overdue ? 'עבר את מועד ההגשה' : 'מועד הגשה'}
    >
      <Flag className="size-3 shrink-0" aria-hidden />
      {overdue ? 'עבר המועד · ' : 'עד '}
      {relativeDayLabel(date, today())}
    </span>
  );
}

export function ProjectChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: swatchVar(color) }}
      />
      {name}
    </span>
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-sm px-1.5 text-xs"
      style={{ color: swatchVar(color), backgroundColor: `color-mix(in oklab, ${swatchVar(color)} 12%, transparent)` }}
    >
      {name}
    </span>
  );
}

/** "כל יום שני" — shown whenever a task repeats, so a row that keeps coming
 *  back explains itself instead of looking like it was never finished. */
export function RepeatChip({ rule }: { rule: string }) {
  const label = describeStored(rule);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" title={label}>
      <Repeat className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export function SubtaskChip({ done, total }: { done: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <ListChecks className="size-3.5 shrink-0" aria-hidden />
      <span className="num">
        {done}/{total}
      </span>
    </span>
  );
}

/** Priority reads as a flag at the inline-end. Level 4 shows nothing at all —
 *  "no priority" is the default and does not need a badge. */
export function PriorityFlag({ priority }: { priority: Priority }) {
  if (priority === 4) return null;
  const color = priority === 1 ? 'text-p1' : priority === 2 ? 'text-p2' : 'text-p3';
  return (
    <span title={PRIORITY_LABELS[priority]} className={cn('shrink-0', color)}>
      <Flag className="size-3.5 fill-current" aria-hidden />
      <span className="sr-only">{PRIORITY_LABELS[priority]}</span>
    </span>
  );
}
