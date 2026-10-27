'use client';

import { CalendarDays, Clock, Flag, Hash, Inbox, ListChecks, Repeat, Tag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { describeStored } from '@/lib/recurrence';
import { relativeDayLabel, isOverdue, today, formatShortDate } from '@/lib/dates';
import { schedulePresentation } from '@/lib/date-presentation';
import { useTaskNow } from './task-clock';
import { swatchVar, PRIORITY_LABELS, type Priority } from '@/lib/constants';

/** Scheduled day (and time), reading as a person would say it. */
export function WhenChip({
  date,
  time,
  muted,
  compact = false,
}: {
  date: Date;
  time?: string | null;
  /** The task is finished. Also suppresses the overdue treatment. */
  muted?: boolean;
  compact?: boolean;
}) {
  // A completed task cannot be late. Leaving it red says the opposite of what
  // the tick next to it says.
  const now = useTaskNow();
  // Past the coming week the relative label is "21.10"; Todoist's "18 Mar"
  // reads as a date without decoding, so do the same in Hebrew.
  const dayLabel = readableDay(date, today(now));
  const presentation = schedulePresentation(date, time, now, muted);
  return (
    <span
      data-schedule-chip
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted"
      aria-label={`${dayLabel}${time ? ` בשעה ${time}` : ''}${presentation.dateTone === 'overdue' || presentation.timeOverdue ? ', באיחור' : ''}`}
    >
      <span data-date-tone={presentation.dateTone} className="inline-flex items-center gap-1">
        {/* Compact rows drop the icon, except when late: then the date is the
            reason the row is here and should read as a date at a glance. */}
        {(!compact || presentation.dateTone === 'overdue') && <CalendarDays className="size-3.5 shrink-0" aria-hidden />}
        <span>{dayLabel}</span>
      </span>
      {time && (
        <span data-time-overdue={presentation.timeOverdue} className="inline-flex items-center gap-1">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span className="num">{time}</span>
        </span>
      )}
    </span>
  );
}

const SHORT_MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

/** "היום", "מחר", a weekday — or "21 אוק׳" once it is past the coming week. */
export function readableDay(date: Date, base: Date) {
  const relative = relativeDayLabel(date, base);
  return relative === formatShortDate(date) ? monthDay(date, base) : relative;
}

/** "21 אוק׳", with the year only when it is not this one. */
export function monthDay(date: Date, base: Date) {
  const label = `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
  return date.getUTCFullYear() === base.getUTCFullYear() ? label : `${label} ${date.getUTCFullYear()}`;
}

/** Deadline. Amber is reserved for this and for overdue — nothing else in the
 *  interface uses it, so the colour always means "time pressure". */
export function DeadlineChip({ date, muted }: { date: Date; muted?: boolean }) {
  const now = useTaskNow();
  const overdue = !muted && isOverdue(date, today(now));
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
      <Flag className="size-3.5 shrink-0" aria-hidden />
      {overdue ? 'עבר המועד · ' : 'עד '}
      {readableDay(date, today(now))}
    </span>
  );
}

export function ProjectChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex max-w-[14rem] items-center gap-1 text-xs text-muted" title={name}>
      <span className="truncate">{name}</span>
      <Hash className="size-3.5 shrink-0" style={{ color: swatchVar(color) }} aria-hidden />
    </span>
  );
}

export function InboxChip() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      תיבה נכנסת
      <Inbox className="size-3.5 shrink-0" aria-hidden />
    </span>
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <Tag className="size-3.5 shrink-0" style={{ color: swatchVar(color) }} aria-hidden />
      {name}
    </span>
  );
}

/** "כל יום שני" — shown whenever a task repeats, so a row that keeps coming
 *  back explains itself instead of looking like it was never finished. */
export function RepeatChip({ rule, compact = false }: { rule: string; compact?: boolean }) {
  const label = describeStored(rule);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" title={label} aria-label={label}>
      <Repeat className="size-3.5 shrink-0" aria-hidden />
      {compact ? <span className="sr-only">{label}</span> : label}
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
