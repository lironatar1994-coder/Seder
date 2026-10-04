'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Cross-view continuity, driven by the platform API.
 *
 * Next's `experimental.viewTransition` needs React's `unstable_ViewTransition`,
 * which the stable React 19.2 in this project does not export — enabling it
 * would mean running an experimental React for one animation. So this calls
 * `document.startViewTransition` itself, which is stable in Chromium and in
 * Safari 18, and simply does not run anywhere else. Nothing degrades except
 * the animation.
 *
 * It intercepts at the document rather than wrapping every `<Link>`. Links to
 * views live in the rail, the tab bar, the settings column, the project list,
 * the calendar and the command palette; a wrapper component would have to be
 * remembered at each one, and the one that was forgotten is the one that jumps.
 */
export function ViewTransitions() {
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Resolves the transition once the new route has actually committed.
   *
   * `router.push` returns before the new tree paints, so resolving immediately
   * would snapshot the *old* page twice and animate nothing. Waiting for
   * `pathname` to change is what tells us React has rendered the destination.
   */
  const commit = useRef<(() => void) | null>(null);

  useEffect(() => {
    commit.current?.();
    commit.current = null;
  }, [pathname]);

  useEffect(() => {
    // Feature-detect once. Older Safari and Firefox get ordinary navigation.
    if (!document.startViewTransition) return;

    function onClick(event: MouseEvent) {
      // Everything the browser is entitled to handle its own way: new tabs,
      // downloads, middle clicks, and any modifier the user pressed.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // Beyond here the navigation is `<Link>`'s to perform; this only brackets
      // it. See the note on the listener registration below.

      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page: there is nothing to transition between.
      if (url.pathname === window.location.pathname) return;

      /* Deliberately no `preventDefault`, and no navigation of our own.
         The transition is *opened* here and the click carries on to `<Link>`,
         which performs the navigation as it always did. Taking the navigation
         over instead means calling `preventDefault`, which stops the same
         click from reaching the other handlers on its way up — the one that
         closes the mobile drawer, among them.

         `startViewTransition` snapshots the page the moment it is called, so
         opening it before the navigation is exactly right: the old frame is
         captured now, and the promise below holds it there until the new route
         has rendered. */
      const transition = document.startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            commit.current = resolve;

            /* A navigation that never commits — a click something else
               cancels, a redirect, a route that errors — would otherwise
               leave the page frozen under a snapshot with no way out. The
               timeout is the escape hatch, not the mechanism. */
            setTimeout(() => {
              if (commit.current === resolve) {
                commit.current = null;
                resolve();
              }
            }, 600);
          }),
      );

      // A skipped or interrupted transition is not an error worth surfacing:
      // the navigation still happened, it just did not animate.
      transition.finished.catch(() => {});
      transition.ready.catch(() => {});
      transition.updateCallbackDone.catch(() => {});
    }

    /* Capture, so this runs before React's handler on the root container.
       In the bubble phase `<Link>` has already called `preventDefault`, and
       the guard above — correctly — refuses to act on an already-handled
       click. */
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return null;
}
