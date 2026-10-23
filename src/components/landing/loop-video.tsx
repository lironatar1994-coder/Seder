'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { LANDING_MEDIA } from './media';

interface LoopVideoProps {
  name: string;
  label: string;
  className?: string;
  /** Set by a parent that shows one recording at a time (the feature tour). */
  active?: boolean;
}

/**
 * A screen recording that behaves like a GIF: muted, looping, inline — at a
 * tenth of a GIF's weight. It only runs while on screen (or while its parent
 * says so) and restarts from the top each time it comes back, so the action
 * is always seen from its first keystroke. Reduced motion gets the poster.
 */
export function LoopVideo({ name, label, className, active = true }: LoopVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (active && visible && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.currentTime = 0;
      void video.play().catch(() => {});
    } else video.pause();
  }, [active, visible]);

  return (
    <video
      ref={ref}
      src={`${LANDING_MEDIA}/${name}.mp4`}
      poster={`${LANDING_MEDIA}/${name}.webp`}
      aria-label={label}
      muted
      loop
      playsInline
      preload="metadata"
      className={cn('block h-auto w-full', className)}
    />
  );
}
