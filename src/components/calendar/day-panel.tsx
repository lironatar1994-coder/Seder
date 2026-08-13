'use client';

import { useTransition } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, Flag, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { swatchVar } from '@/lib/constants';
import { buildLockup } from '@/lib/hebrew-date';
import { parseISODay } from '@/lib/calendar';
import { relativeDayLabel, today, weekdayName } from '@/lib/dates';
import type { CalendarEntry } from '@/server/tasks/queries';
import { toggleTaskAction } from '@/server/tasks/actions';
import { useToast } from '@/components/ui/toast';
import { Composer } from '@/components/task/composer';

/**
 * One day, opened from the grid.
 *
 * Enters from the inline-end — the left in Hebrew — so it never covers the
 * grid's reading edge, matching the task detail panel.
 */
export function DayPanel({
  iso,
  entries,
  projects,
  labels,
  onClose,
  onOpenTask,
}: {
  iso: string;
  entries: CalendarEntry[];
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  const date = parseISODay(iso);
  const lockup = buildLockup(date);
  const relative = relativeDayLabel(date, today());
  const weekday = weekdayName(date);

  const scheduled = entries.filter((e) => e.kind === 'scheduled');
  const deadlines = entries.filter((e) => e.kind === 'deadline');

  const toggle = (entry: CalendarEntry) =>
    startTransition(async () => {
      const result = await toggleTaskAction(entry.taskId, entry.task.status === 'TODO');
      if (!result.ok) toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
    });

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim-soft md:bg-transparent" />
        <DialogPrimitive.Content
          className={cn(
            'shadow-panel-edge fixed inset-bs-0 inset-be-0 inset-e-0 z-50 flex w-[min(26rem,100vw)] flex-col',
            'border-s border-line bg-surface animate-fade-up',
          )}
        >
          <DialogPrimitive.Title className="sr-only">{`${weekday} ${lockup.gregorianFull}`}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            המשימות של היום הזה
          </DialogPrimitive.Description>

          <header className="flex items-start justify-between gap-3 border-be border-line px-4 py-3">
            <div className="min-w-0">
              <p className="display text-2xl font-bold leading-tight text-ink">
                {relative === weekday ? weekday : relative}
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
                {relative !== weekday && <span>{weekday}</span>}
                {lockup.hebrew && <span className="display text-ink-2">{lockup.hebrew}</span>}
                <span aria-hidden className="text-line-strong">
                  ·
                </span>
                <span className="num">{lockup.gregorian}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="-me-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>

          <div className="scroll-quiet flex-1 space-y-5 overflow-y-auto p-4">
            <Composer
              context={{ view: 'calendar', defaultDate: iso }}
              vocabulary={{
                projects: projects.map((p) => p.name),
                labels: labels.map((l) => l.name),
              }}
              autoFocus={false}
            />

            {scheduled.length === 0 && deadlines.length === 0 && (
              <p className="px-1 text-sm text-muted">היום הזה פנוי. אפשר להוסיף משימה למעלה.</p>
            )}

            {scheduled.length > 0 && (
              <ul className="space-y-0.5">
                {scheduled.map((entry) => (
                  <li key={entry.key} className="flex items-start gap-2.5 rounded-lg px-1 py-1.5 hover:bg-surface-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={entry.task.status !== 'TODO'}
                      aria-label={
                        entry.task.status !== 'TODO'
                          ? `ביטול השלמה: ${entry.task.title}`
                          : `סימון כהושלם: ${entry.task.title}`
                      }
                      onClick={() => toggle(entry)}
                      className={cn(
                        'mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border-2 transition-colors',
                        entry.task.status !== 'TODO'
                          ? 'border-accent bg-accent'
                          : 'border-line-strong hover:border-accent',
                      )}
                    >
                      <Check
                        className={cn(
                          'size-2.5 text-[var(--on-accent)]',
                          entry.task.status !== 'TODO' ? 'opacity-100' : 'opacity-0',
                        )}
                        strokeWidth={4}
                        aria-hidden
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenTask(entry.taskId)}
                      className="min-w-0 flex-1 text-start"
                    >
                      <span
                        dir="auto"
                        className={cn(
                          'block text-sm leading-snug',
                          entry.task.status !== 'TODO'
                            ? 'text-muted line-through'
                            : 'text-ink',
                        )}
                      >
                        {entry.task.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        {entry.time && <span className="num font-semibold">{entry.time}</span>}
                        {entry.task.project && (
                          <span className="inline-flex items-center gap-1">
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: swatchVar(entry.task.project.color) }}
                            />
                            {entry.task.project.name}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {deadlines.length > 0 && (
              <section className="space-y-1">
                <h3 className="flex items-center gap-1.5 px-1 text-xs font-bold text-flag">
                  <Flag className="size-3" aria-hidden />
                  מועדי הגשה
                </h3>
                <ul className="space-y-0.5">
                  {deadlines.map((entry) => (
                    <li key={entry.key}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(entry.taskId)}
                        className="w-full rounded-lg px-1 py-1.5 text-start text-sm text-ink hover:bg-surface-2"
                      >
                        <span dir="auto">{entry.task.title}</span>
                        {entry.task.scheduledFor && (
                          <span className="mt-0.5 block text-xs text-muted">
                            מתוזמן ל{relativeDayLabel(entry.task.scheduledFor, today())}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
