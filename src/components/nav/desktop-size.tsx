'use client';

import { useEffect } from 'react';

export const DESKTOP_SIZES = [
  { value: 'compact', label: 'קומפקטי' },
  { value: 'comfortable', label: 'נוח' },
  { value: 'large', label: 'גדול' },
] as const;
export type DesktopSize = typeof DESKTOP_SIZES[number]['value'];
const KEY = 'seder-desktop-size';
function valid(value: string | null): DesktopSize {
  return DESKTOP_SIZES.some(option => option.value === value) ? value as DesktopSize : 'comfortable';
}
export function readDesktopSize(): DesktopSize {
  try { return valid(localStorage.getItem(KEY)); } catch { return 'comfortable'; }
}
export function applyDesktopSize(value: DesktopSize) {
  document.documentElement.dataset.desktopSize = value;
  try { localStorage.setItem(KEY, value); } catch {}
  window.dispatchEvent(new Event('seder:desktop-size'));
}
export function DesktopSizeGate() {
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== KEY && event.key !== null) return;
      document.documentElement.dataset.desktopSize = readDesktopSize();
      window.dispatchEvent(new Event('seder:desktop-size'));
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return null;
}
