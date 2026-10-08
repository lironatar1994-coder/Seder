'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** The workspace scrolls in <main>, so the browser's window scroll
 * restoration cannot remember where the user was reading. */
export function NavigationScroll() {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = `${pathname}?${params}`;
  const positions = useRef(new Map<string, number>());
  const activeKey = useRef(key);
  const navigating = useRef(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const remember = () => {
      const main = document.querySelector('main');
      if (main) positions.current.set(activeKey.current, main.scrollTop);
      navigating.current = true;
      clearTimeout(timeout);
      timeout = setTimeout(() => { navigating.current = false; }, 1000);
    };
    const click = (event: MouseEvent) => {
      if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const anchor = (event.target as Element | null)?.closest('a');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href);
      if (url.origin === location.origin && url.href !== location.href) remember();
    };
    document.addEventListener('click', click, true);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', click, true);
    };
  }, []);

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const previous = positions.current.get(key);
    activeKey.current = key;
    const frame = requestAnimationFrame(() => {
      // Restore any visited destination by route identity; cached routes
      // can commit before the browser's popstate listeners finish running.
      if (previous !== undefined) main.scrollTop = previous;
      positions.current.set(key, main.scrollTop);
      if (positions.current.size > 200) positions.current.delete(positions.current.keys().next().value!);
      navigating.current = false;
    });
    const save = () => {
      if (navigating.current || !location.pathname.endsWith(pathname) || location.search.slice(1) !== params.toString()) return;
      positions.current.set(key, main.scrollTop);
      // Keep long-running sessions bounded.
      if (positions.current.size > 200) positions.current.delete(positions.current.keys().next().value!);
    };
    main.addEventListener('scroll', save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      main.removeEventListener('scroll', save);
    };
  }, [key]);
  return null;
}
