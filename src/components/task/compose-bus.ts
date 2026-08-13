'use client';

/**
 * Lets the mobile tab bar open the composer that lives inside the task list.
 *
 * The two are siblings under the app shell with no common ancestor holding this
 * state, and the composer has to stay where it is: it adds into whatever view
 * is on screen, so a project page files into that project and Today schedules
 * for today. Lifting that context up to the shell would mean teaching the shell
 * about every view.
 *
 * A registry rather than a custom event because the caller needs the answer
 * synchronously — if no list is mounted (the calendar, settings), the tab bar
 * has to navigate somewhere that has one instead of dropping the tap.
 */
let open: (() => void) | null = null;

/** Called by the mounted task list. Returns its own unregister. */
export function registerComposer(fn: () => void): () => void {
  open = fn;
  return () => {
    if (open === fn) open = null;
  };
}

/** Opens the composer if a list is mounted. `false` means nothing handled it. */
export function requestCompose(): boolean {
  if (!open) return false;
  open();
  return true;
}
