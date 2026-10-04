'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PRIORITY_LABELS, swatchVar } from '@/lib/constants';
import { relativeDayLabel, today } from '@/lib/dates';
import type { CalendarEntry } from '@/server/tasks/queries';
import { toggleTaskAction } from '@/server/tasks/actions';
import { useToast } from '@/components/ui/toast';

/**
 * One calendar entry as a row of text.
 *
 * Shared by the day panel and the phone agenda so a task reads the same in
 * both — the alternative is two divergent copies of "what a task looks like on
 * a date", which is exactly how the phone ended up with coloured dots while
 * the desktop had titles.
 *
 * A deadline row has no checkbox. Ticking it would complete the task from a
 * date that is not the day you planned to do it, and the mark would sit on a
 * row whose whole meaning is "this is when it is due", not "this is the work".
 */
export function EntryRow({
  entry,
  onOpen,
}: {
  entry: CalendarEntry;
  onOpen: (taskId: string) => void;
}) {
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const done = entry.task.status !== 'TODO';
  const ring = entry.task.priority === 1 ? 'border-p1' : entry.task.priority === 2 ? 'border-p2' : entry.task.priority === 3 ? 'border-p3' : 'border-p4';

  const toggle = () =>
    startTransition(async () => {
      const result = await toggleTaskAction(entry.taskId, entry.task.status === 'TODO');
      if (!result.ok) toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
    });

  if (entry.kind === 'deadline') {
    return (
      <button
        type="button"
        onClick={() => onOpen(entry.taskId)}
        className={cn(
          'flex w-full flex-col justify-center rounded-lg px-1 py-2 text-start text-base text-ink',
          'hover:bg-surface-2 [@media(pointer:coarse)]:min-h-11',
        )}
      >
        <span dir="auto">{entry.task.title}</span>
        {entry.task.scheduledFor && (
          <span className="mt-0.5 block text-xs text-muted">
            מתוזמן ל{relativeDayLabel(entry.task.scheduledFor, today())}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg px-1 py-1.5 hover:bg-surface-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `ביטול השלמה: ${entry.task.title}` : `סימון כהושלם: ${entry.task.title}`}
        aria-description={`עדיפות: ${PRIORITY_LABELS[entry.task.priority]}`}
        title={PRIORITY_LABELS[entry.task.priority]}
        onClick={toggle}
        className={cn(
          'relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
          done ? 'border-accent bg-accent' : `${ring} hover:border-accent`,
          // Same 20px control and 44px touch target as the task list.
          "before:absolute before:content-['']",
          '[@media(pointer:coarse)]:before:-inset-3',
        )}
      >
        <Check
          className={cn('size-3 text-[var(--on-accent)]', done ? 'opacity-100' : 'opacity-0')}
          strokeWidth={3.5}
          aria-hidden
        />
      </button>

      <button
        type="button"
        onClick={() => onOpen(entry.taskId)}
        className={cn(
          'flex min-w-0 flex-1 flex-col justify-center text-start',
          '[@media(pointer:coarse)]:min-h-11',
        )}
      >
        <span
          dir="auto"
          className={cn(
            'block text-base leading-snug',
            done ? 'text-muted line-through' : 'text-ink',
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
    </div>
  );
}
