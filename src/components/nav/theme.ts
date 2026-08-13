'use client';

/**
 * Appearance is two independent axes.
 *
 *   mode   — light, dark, or follow the operating system
 *   accent — which hue carries state, interaction and focus
 *
 * They compose: any accent works in either mode, because the accent tokens are
 * derived from a hue variable while lightness and chroma come from the mode
 * tier. Adding a theme is one entry here and three numbers in globals.css.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

export const ACCENTS = [
  { value: 'indigo', label: 'אינדיגו' },
  { value: 'violet', label: 'סגול' },
  { value: 'blue', label: 'כחול' },
  { value: 'teal', label: 'טורקיז' },
  { value: 'green', label: 'ירוק' },
  { value: 'pink', label: 'ורוד' },
  { value: 'graphite', label: 'גרפיט' },
] as const;

export type Accent = (typeof ACCENTS)[number]['value'];

export const DEFAULT_ACCENT: Accent = 'indigo';

export const MODE_STORAGE_KEY = 'seder-theme';
export const ACCENT_STORAGE_KEY = 'seder-accent';

function isAccent(value: string | undefined): value is Accent {
  return ACCENTS.some((a) => a.value === value);
}

/**
 * "system" is the absence of a stored value, matching the inline bootstrap
 * script in the root layout: it only stamps `data-theme` when a choice was
 * made, so no attribute means the CSS media query decides.
 */
export function readMode(): ThemeMode {
  if (typeof document === 'undefined') return 'system';
  const attr = document.documentElement.dataset.theme;
  return attr === 'dark' || attr === 'light' ? attr : 'system';
}

export function readAccent(): Accent {
  if (typeof document === 'undefined') return DEFAULT_ACCENT;
  const attr = document.documentElement.dataset.accent;
  return isAccent(attr) ? attr : DEFAULT_ACCENT;
}

export function applyMode(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'system') delete root.dataset.theme;
  else root.dataset.theme = mode;
  store(MODE_STORAGE_KEY, mode === 'system' ? null : mode);
}

export function applyAccent(accent: Accent): void {
  const root = document.documentElement;
  // The default is the bare `:root` rule, so it needs no attribute.
  if (accent === DEFAULT_ACCENT) delete root.dataset.accent;
  else root.dataset.accent = accent;
  store(ACCENT_STORAGE_KEY, accent === DEFAULT_ACCENT ? null : accent);
}

function store(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode with storage disabled: the choice still applies to this
    // page, it just will not be remembered.
  }
}

/** What "system" currently resolves to, for the quick toggle's icon. */
export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
