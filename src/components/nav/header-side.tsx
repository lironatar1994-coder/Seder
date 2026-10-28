'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders into the far side of the view header's meta row, so a small control
 * shares that row instead of opening one of its own above the list. Renders
 * `fallback` in place when the page has no view header.
 */
export function HeaderSide({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [host, setHost] = useState<Element | null | undefined>(undefined);
  useEffect(() => {
    setHost(document.querySelector('[data-header-side]'));
  }, []);
  if (host === undefined) return null;
  return host ? createPortal(children, host) : <>{fallback}</>;
}
