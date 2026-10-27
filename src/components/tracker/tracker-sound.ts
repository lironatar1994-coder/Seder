'use client';

import { completionSoundEnabled, playCompletionSound } from '@/lib/completion-sound';

/**
 * Small synthesized cues for the habit table, on the same switch as the
 * completion chime (Settings → Appearance). Synthesized rather than sampled:
 * no files to load, and each cue is a few milliseconds of sine.
 */

type Note = { f: number; at: number; len: number; gain: number; type?: OscillatorType };

const CUES: Record<'check' | 'uncheck' | 'add' | 'create', Note[]> = {
  // A bright two-note tick: the V landing.
  check: [
    { f: 1046.5, at: 0, len: 0.09, gain: 0.05 },
    { f: 1568, at: 0.05, len: 0.14, gain: 0.04 },
  ],
  // One soft, lower note: taking it back should not sound like a success.
  uncheck: [{ f: 392, at: 0, len: 0.1, gain: 0.04, type: 'triangle' }],
  add: [
    { f: 660, at: 0, len: 0.07, gain: 0.035 },
    { f: 990, at: 0.035, len: 0.09, gain: 0.025 },
  ],
  create: [
    { f: 523.25, at: 0, len: 0.12, gain: 0.04 },
    { f: 783.99, at: 0.06, len: 0.14, gain: 0.035 },
    { f: 1046.5, at: 0.12, len: 0.2, gain: 0.03 },
  ],
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!completionSoundEnabled()) return null;
  const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return null;
  try {
    context ??= new Constructor();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

export function playTrackerCue(cue: keyof typeof CUES) {
  const ctx = audio();
  if (!ctx) return;
  try {
    const start = ctx.currentTime + 0.005;
    for (const note of CUES[cue]) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const at = start + note.at;
      osc.type = note.type ?? 'sine';
      osc.frequency.setValueAtTime(note.f, at);
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(note.gain, at + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, at + note.len);
      osc.connect(env);
      env.connect(ctx.destination);
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };
      osc.start(at);
      osc.stop(at + note.len + 0.01);
    }
  } catch {
    /* Sound never blocks a check. */
  }
}

/** A full row or a full day: the app's own completion chime. */
export function playTrackerMilestone() {
  void playCompletionSound();
}
