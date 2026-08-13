/**
 * Reading configuration that may be present, absent, or present-and-empty.
 *
 * `??` only catches the second of those. The release writes every optional
 * knob into `.env.production` whether or not it has a value, so an unset one
 * arrives as `""` — which is not nullish, so the default is skipped, and
 * `Number("")` is `0`. A daily send cap of zero silently refuses every
 * message; a reminder lead of zero quietly stops being a lead.
 *
 * Empty is the normal way for these to be unset, so it has to mean "unset".
 */

export function envNumber(raw: string | undefined | null, fallback: number): number {
  if (raw === undefined || raw === null || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  // A typo should not silently become zero either.
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function envFlag(raw: string | undefined | null): boolean {
  const value = (raw ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

/** A string setting, with empty treated as absent. */
export function envText(raw: string | undefined | null): string | undefined {
  const value = (raw ?? '').trim();
  return value === '' ? undefined : value;
}
