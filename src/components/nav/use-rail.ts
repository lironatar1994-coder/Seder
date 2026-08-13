'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Whether the desktop sidebar is collapsed.
 *
 * Stored in localStorage and stamped onto `<html>` by the same inline
 * bootstrap that sets the theme, so a collapsed rail is already collapsed on
 * the first paint. Reading it in an effect instead would open the sidebar,
 * paint, and slam it shut — the exact flash the theme script exists to avoid.
 *
 * The attribute is the source of truth for CSS; this hook only mirrors it for
 * the toggle's own label and `aria-expanded`.
 */
const KEY = 'seder-rail';
const ATTR = 'data-rail';

export function useRail() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.rail === 'collapsed');
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      const root = document.documentElement;

      if (next) root.setAttribute(ATTR, 'collapsed');
      else root.removeAttribute(ATTR);

      try {
        // Absent means open, like every other preference in this app.
        if (next) localStorage.setItem(KEY, 'collapsed');
        else localStorage.removeItem(KEY);
      } catch {
        // Private mode. The rail still works for this session.
      }

      return next;
    });
  }, []);

  return { collapsed, toggle };
}
