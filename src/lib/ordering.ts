/** Fractional indexing: reordering a list writes exactly one row.
 *
 *  Positions are short strings ordered lexicographically, so inserting between
 *  two neighbours means asking for a key between their two keys — no shifting
 *  the rest of the list, no periodic rebalancing pass.
 */

import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

export function keyBetween(a: string | null, b: string | null): string {
  return generateKeyBetween(a, b);
}

/** `count` evenly-spaced keys between two neighbours — used when seeding and
 *  when a drag moves several selected rows at once. */
export function keysBetween(a: string | null, b: string | null, count: number): string[] {
  return generateNKeysBetween(a, b, count);
}

/** Key that sorts after everything in `existing`. */
export function keyAfterLast(existing: readonly { position: string }[]): string {
  const last = existing.length ? existing[existing.length - 1].position : null;
  return generateKeyBetween(last, null);
}

/** Key that sorts before everything in `existing` — new tasks land at the top
 *  of a list, which is where you look for the thing you just typed. */
export function keyBeforeFirst(existing: readonly { position: string }[]): string {
  const first = existing.length ? existing[0].position : null;
  return generateKeyBetween(null, first);
}

/**
 * Position for dropping an item at `toIndex` in `ordered`, with the dragged
 * item already removed from that array.
 */
export function positionForIndex(
  ordered: readonly { position: string }[],
  toIndex: number,
): string {
  const before = toIndex > 0 ? ordered[toIndex - 1]?.position ?? null : null;
  const after = toIndex < ordered.length ? ordered[toIndex]?.position ?? null : null;
  return generateKeyBetween(before, after);
}
