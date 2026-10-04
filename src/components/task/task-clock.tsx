'use client';

import { createContext, startTransition, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { today } from '@/lib/dates';

const Context = createContext<Date | null>(null);

/** One clock for row labels and Today grouping. Initial server time avoids
 * hydration differences. Minute ticks update locally; midnight fetches the
 * new day's tasks/header. Resuming a sleeping phone updates immediately. */
export function TaskClockProvider({ initialMinute, children }: { initialMinute: number; children: React.ReactNode }) {
  const [minute, setMinute] = useState(initialMinute);
  const day = useRef(today(new Date(initialMinute)).toISOString());
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      setMinute(Math.floor(now / 60_000) * 60_000);
      const currentDay = today(new Date(now)).toISOString();
      if (currentDay !== day.current) {
        day.current = currentDay;
        startTransition(() => router.refresh());
      }
    }
    function tick() {
      update();
      timer = setTimeout(tick, 60_000 - Date.now() % 60_000 + 25);
    }
    tick();
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); };
  }, [router]);
  const value = useMemo(() => new Date(minute), [minute]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTaskNow(): Date { return useContext(Context) ?? new Date(); }
