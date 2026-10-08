'use client';
import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { completionSoundEnabled, playCompletionSound, setCompletionSoundEnabled } from '@/lib/completion-sound';
import { SettingRow } from './shell';
export function CompletionSoundSetting() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const read = () => setEnabled(completionSoundEnabled());
    read();
    window.addEventListener('storage', read);
    window.addEventListener('seder:sound-preference', read);
    return () => { window.removeEventListener('storage', read); window.removeEventListener('seder:sound-preference', read); };
  }, []);
  const Icon = enabled ? Volume2 : VolumeX;
  return <SettingRow label="צליל השלמה" description="צליל קצר כשמשימה הושלמה. ההעדפה נשמרת במכשיר הזה." control="auto">
    <button type="button" role="switch" aria-label="צליל השלמה" aria-checked={enabled}
      onClick={() => { const next = !enabled; setCompletionSoundEnabled(next); setEnabled(next); if (next) void playCompletionSound(); }}
      className="inline-flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm text-ink-2">
      <Icon className="size-4" aria-hidden /><span>{enabled ? 'פעיל' : 'כבוי'}</span>
      <span aria-hidden className={cn('flex h-6 w-10 items-center rounded-full p-0.5', enabled ? 'justify-end bg-accent' : 'justify-start bg-line-strong')}><span className="size-5 rounded-full bg-paper" /></span>
    </button>
  </SettingRow>;
}
