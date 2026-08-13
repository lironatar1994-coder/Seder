'use client';

import { useEffect, useState } from 'react';

/**
 * True on a phone-width viewport.
 *
 * For the handful of cases where a layout difference cannot be expressed in
 * CSS because it is a difference in *where a thing is mounted* — the composer
 * is an inline block on a desktop and a sheet at the thumb end on a phone, and
 * rendering both would mean two inputs, two autofocuses and two sets of state.
 *
 * Starts `false` and corrects in an effect, so the server and the first client
 * render agree. Every caller opens its subject from a user action, which
 * happens after hydration, so the initial value is never the one on screen.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    // The same 48rem the `md:` utilities break at.
    const query = window.matchMedia('(width < 48rem)');
    const sync = () => setPhone(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return phone;
}
