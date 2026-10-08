'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getNavigationTaskAction } from '@/server/tasks/actions';
import type { TaskDTO } from '@/server/tasks/queries';
import { useToast } from '@/components/ui/toast';

/** UI navigation shares the browser stack with Next's route navigation.
 * Native history updates keep the current server tree and scroll position.
 * Next copies its own router state; never copy its private markers ourselves.
 */
export function updateNavigation(values: Record<string, string | null>, replace = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (url.href === window.location.href) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
}

export function useNavigationParam(key: string) {
  const params = useSearchParams();
  const value = params.get(key);
  const setValue = useCallback((next: string | null) => updateNavigation({ [key]: next }), [key]);
  return [value, setValue] as const;
}

/** A task can move out of a view after editing. Returning to its detail
 * must load the current, authorized task rather than an old snapshot. */
export function useNavigationTask(id: string | null, incoming: TaskDTO | null, revision?: unknown) {
  const [loaded, setLoaded] = useState<TaskDTO | null>(null);
  const { toast } = useToast();
  useEffect(() => {
    let cancelled = false;
    if (!id || incoming) { setLoaded(null); return; }
    getNavigationTaskAction(id).then((task) => {
      if (cancelled) return;
      setLoaded(task);
      if (!task) toast({ message: 'המשימה אינה זמינה יותר', tone: 'error' });
    }).catch(() => {
      if (!cancelled) toast({ message: 'המשימה לא נטענה. אפשר לנסות שוב.', tone: 'error' });
    });
    return () => { cancelled = true; };
    // A task edited out of the view is absent from its groups, but subsequent
    // mutations still revalidate the route. Reload its held detail on that
    // new server snapshot so it cannot override edits with an old record.
  }, [id, incoming, revision, toast]);
  return incoming ?? (loaded?.id === id ? loaded : null);
}
