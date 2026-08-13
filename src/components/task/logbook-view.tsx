'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { loadMoreLogbookAction } from '@/server/tasks/actions';
import type { LogbookPage, TaskDTO, TaskGroup } from '@/server/tasks/queries';
import { toDayStart } from '@/lib/dates';
import { TaskList } from './task-list';

/**
 * The Logbook, paginated.
 *
 * Grouping happens here rather than on the server because pages arrive one at a
 * time and a day can straddle two of them — regrouping the accumulated list is
 * the only way the last group of one page and the first of the next merge
 * instead of appearing as two headings for the same day.
 */
export function LogbookView({
  initial,
  projects,
  labels,
}: {
  initial: LogbookPage;
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
}) {
  const [tasks, setTasks] = useState<TaskDTO[]>(initial.tasks);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  // Completing or reopening something revalidates the page and hands us a fresh
  // first page; drop the accumulated tail rather than show a stale mixture.
  useEffect(() => {
    setTasks(initial.tasks);
    setCursor(initial.nextCursor);
  }, [initial]);

  const groups: TaskGroup[] = useMemo(() => {
    const byDay = new Map<string, TaskDTO[]>();
    for (const task of tasks) {
      const key = task.completedAt
        ? toDayStart(task.completedAt).toISOString().slice(0, 10)
        : 'unknown';
      const bucket = byDay.get(key);
      if (bucket) bucket.push(task);
      else byDay.set(key, [task]);
    }
    return [...byDay.entries()].map(([key, dayTasks]) => ({
      key,
      title: key,
      tasks: dayTasks,
    }));
  }, [tasks]);

  function loadMore() {
    if (!cursor || pending) return;
    startTransition(async () => {
      const page = await loadMoreLogbookAction(cursor);
      // Guard against a double click racing two requests to the same cursor.
      setTasks((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...page.tasks.filter((t) => !seen.has(t.id))];
      });
      setCursor(page.nextCursor);
      if (!page.tasks.length) toast({ message: 'אין עוד היסטוריה' });
    });
  }

  return (
    <TaskList
      groups={groups}
      context={{ view: 'logbook' }}
      projects={projects}
      labels={labels}
      dayHeadings
      reorderable={false}
      // A record of what was done is not somewhere you add work.
      showComposer={false}
      empty={{
        title: 'עוד לא נסגרה משימה',
        body: 'כל מה שתשלימו יופיע כאן, מהחדש לישן.',
      }}
      footer={
        <div className={cn('mt-2 flex flex-col items-center gap-2', !tasks.length && 'hidden')}>
          {cursor ? (
            <Button variant="secondary" size="sm" onClick={loadMore} disabled={pending}>
              {pending ? 'טוענים…' : 'טעינת עוד'}
            </Button>
          ) : (
            <p className="text-xs text-muted">זו כל ההיסטוריה.</p>
          )}
        </div>
      }
    />
  );
}
