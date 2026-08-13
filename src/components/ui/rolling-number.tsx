'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * A count that moves when it changes.
 *
 * These numbers are the app telling you something happened somewhere else —
 * you completed a task in Today and the Inbox badge drops. Snapped, that is a
 * pixel change you were not looking at and will never notice. Rolled, it
 * catches the eye for 200ms and then stops, which is the whole job.
 *
 * The direction carries the meaning: a count going *down* rolls down, and down
 * is the good direction in a to-do list. Getting that backwards would make
 * finishing work feel like accruing it.
 *
 * Both values are rendered during the swap so one leaves as the other arrives.
 * A keyed remount would only animate the incoming digit, which reads as a
 * flicker rather than a roll.
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const [current, setCurrent] = useState(value);
  const [leaving, setLeaving] = useState<{ value: number; up: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === current) return;

    setLeaving({ value: current, up: value > current });
    setCurrent(value);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(null), 240);
  }, [value, current]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <span
      className={cn('num relative inline-grid overflow-hidden align-middle', className)}
      /* One sign drives both halves, so they always travel the same way: the
         old number leaves in the direction the new one came from. */
      style={{ ['--roll' as string]: leaving?.up ? 1 : -1 }}
      // The accessible value is the number itself. Without this the departing
      // copy is read out too, and the badge announces "4 5".
      aria-label={String(value)}
    >
      <span aria-hidden className={cn('col-start-1 row-start-1', leaving && 'animate-roll-in')}>
        {current}
      </span>
      {leaving && (
        <span aria-hidden className="col-start-1 row-start-1 animate-roll-out">
          {leaving.value}
        </span>
      )}
    </span>
  );
}
