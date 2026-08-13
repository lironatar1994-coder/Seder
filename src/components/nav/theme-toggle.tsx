'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { applyMode, readMode, systemPrefersDark, type ThemeMode } from './theme';

/**
 * The quick flip in the sidebar. Two states only — the three-way choice,
 * including "follow the system", lives in settings, where there is room to
 * explain it.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeMode | null>(null);
  const [systemDark, setSystemDark] = useState(false);

  // Resolved after mount: before hydration the server cannot know which theme
  // the inline bootstrap script picked.
  useEffect(() => {
    setChoice(readMode());
    setSystemDark(systemPrefersDark());
  }, []);

  const isDark = choice === 'dark' || (choice === 'system' && systemDark);

  function toggle() {
    const next: ThemeMode = isDark ? 'light' : 'dark';
    applyMode(next);
    setChoice(next);
  }

  return (
    <IconButton
      label={isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
      onClick={toggle}
      className="size-8"
    >
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </IconButton>
  );
}
