'use client';
import { useEffect } from 'react';
import { disposeCompletionSound, unlockCompletionSound } from '@/lib/completion-sound';
export function CompletionSoundGate() {
  useEffect(() => {
    window.addEventListener('pointerdown', unlockCompletionSound, true);
    window.addEventListener('keydown', unlockCompletionSound, true);
    return () => {
      window.removeEventListener('pointerdown', unlockCompletionSound, true);
      window.removeEventListener('keydown', unlockCompletionSound, true);
      disposeCompletionSound();
    };
  }, []);
  return null;
}
