'use client';

export const COMPLETION_SOUND_KEY = 'seder-completion-sound';
export const COMPLETION_NOTES = [
  { frequency: 587.33, start: 0, duration: 0.18, gain: 0.065 },
  { frequency: 880, start: 0.045, duration: 0.22, gain: 0.045 },
  { frequency: 1174.66, start: 0.095, duration: 0.19, gain: 0.025 },
] as const;
let context: AudioContext | null = null;
let lastPlayed = -Infinity;
export function completionSoundEnabled() {
  if (typeof window === 'undefined') return true;
  try { return localStorage.getItem(COMPLETION_SOUND_KEY) !== 'off'; } catch { return true; }
}
export function disposeCompletionSound() {
  const old = context;
  context = null;
  lastPlayed = -Infinity;
  if (old && old.state !== 'closed') void old.close().catch(() => {});
}
export function setCompletionSoundEnabled(enabled: boolean) {
  try { localStorage.setItem(COMPLETION_SOUND_KEY, enabled ? 'on' : 'off'); } catch {}
  if (!enabled) disposeCompletionSound();
  window.dispatchEvent(new Event('seder:sound-preference'));
}
/** Unlock during a real click/key gesture, before the save request completes. */
export function unlockCompletionSound() {
  if (!completionSoundEnabled()) return;
  const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return;
  try {
    context ??= new Constructor();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch { /* Audio support never blocks completing a task. */ }
}
export async function playCompletionSound() {
  if (!completionSoundEnabled()) return;
  unlockCompletionSound();
  const audio = context;
  if (!audio) return;
  try {
    if (audio.state === 'suspended') await audio.resume();
    if (audio.state !== 'running' || !completionSoundEnabled() || audio.currentTime - lastPlayed < 0.12) return;
    lastPlayed = audio.currentTime;
    const start = audio.currentTime + 0.005;
    for (const note of COMPLETION_NOTES) {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const at = start + note.start;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, at);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(note.gain, at + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
      oscillator.connect(envelope);
      envelope.connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(at);
      oscillator.stop(at + note.duration + 0.01);
    }
    window.dispatchEvent(new Event('seder:completion-sound'));
  } catch { /* Silent fallback for unavailable or interrupted audio. */ }
}
