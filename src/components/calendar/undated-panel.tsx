'use client';

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CalendarCheck2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { swatchVar } from '@/lib/constants';
import type { CalendarEntry, TaskDTO } from '@/server/tasks/queries';
import { Composer } from '@/components/task/composer';
import { CompleteCircle } from './entry-chip';
import { useCalendarActions } from './calendar-context';

/**
 * "ללא תאריך" — Todoist's No date tray. Everything open without a day, ready
 * to be dragged onto the calendar: dropped on a day it gets that day, on an
 * hour it gets the hour as well.
 */
export function UndatedPanel({
  tasks,
  projects,
  labels,
  onClose,
}: {
  tasks: TaskDTO[];
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  onClose: () => void;
}) {
  const [composing, setComposing] = useState(false);

  return (
    <aside
      aria-label="משימות ללא תאריך"
      className="flex max-h-[max(30rem,calc(100dvh-16rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface"
    >
      <header className="flex items-center gap-2 border-be border-line px-4 py-3">
        <h2 className="text-base font-bold text-ink">ללא תאריך</h2>
        <span className="num text-sm text-muted">{tasks.length}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירת ללא תאריך"
          className="-me-1.5 ms-auto grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="scroll-quiet flex-1 overflow-y-auto px-2 py-1.5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <CalendarCheck2 className="size-8 text-muted" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-ink">לכל משימה יש יום</p>
            <p className="mt-1 text-xs text-muted">משימה חדשה בלי תאריך תופיע כאן, מוכנה לגרירה ללוח.</p>
          </div>
        ) : (
          <>
            <p className="px-2 pb-1.5 pt-1 text-xs text-muted">גוררים משימה ליום או לשעה כדי לתזמן אותה.</p>
            <ul>
              {tasks.map((task) => (
                <li key={task.id}>
                  <UndatedRow task={task} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="border-bs border-line p-2">
        {composing ? (
          <Composer
            context={{ view: 'anytime' }}
            projects={projects}
            vocabulary={{ projects: projects.map((p) => p.name), labels: labels.map((l) => l.name) }}
            onClose={() => setComposing(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="group/add flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted transition-colors hover:text-accent"
          >
            <span className="grid size-5 place-items-center rounded-full text-accent transition-colors group-hover/add:bg-accent group-hover/add:text-[var(--on-accent)]">
              <Plus className="size-4" aria-hidden />
            </span>
            הוספת משימה
          </button>
        )}
      </div>
    </aside>
  );
}

function UndatedRow({ task }: { task: TaskDTO }) {
  const { openTask, completing } = useCalendarActions();
  /* Shaped as a calendar entry so the one drop handler serves the tray and the
     grid alike. An empty `iso` never equals a target day, so any drop moves it. */
  const entry: CalendarEntry = { key: `${task.id}:undated`, taskId: task.id, kind: 'scheduled', iso: '', time: null, task };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.key, data: { entry } });
  const done = completing.has(task.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-start gap-2.5 border-be border-line/70 px-2 py-2.5 last:border-be-0',
        isDragging && 'opacity-30',
        done && 'opacity-55',
      )}
    >
      <span className="pt-0.5">
        <CompleteCircle task={task} done={done} size="md" />
      </span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => openTask(task.id)}
        className="min-w-0 flex-1 cursor-grab text-start active:cursor-grabbing"
      >
        <span dir="auto" className={cn('block text-sm leading-5 text-ink', done && 'line-through')}>
          {task.title}
        </span>
        {task.project && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ backgroundColor: swatchVar(task.project.color) }}
            />
            <span dir="auto" className="truncate">
              {task.project.name}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}
