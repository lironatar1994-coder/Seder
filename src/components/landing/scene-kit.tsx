'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * The landing page's animated scenes are drawn, not recorded: each one is a
 * zoomed-in, simplified slice of the interface built from the app's tokens,
 * driven by a single looping clock. Everything a scene shows is a pure
 * function of `t`, so a scene can be paused, restarted, rendered statically
 * for reduced motion, or recorded to a GIF frame-for-frame.
 *
 * Sizes inside a scene are in container units (`cqw`), so a scene scales like
 * an image — the same composition on a 360px phone and a 700px column, with
 * nothing reflowing mid-animation.
 */

export interface SceneProps {
  /** A parent that shows one scene at a time can hold the others still. */
  active?: boolean;
}

export function useSceneClock(loopMs: number, still: number, active = true) {
  const ref = useRef<HTMLDivElement>(null);
  // The server renders the still frame, which is also what reduced motion and
  // a scene that has not yet been scrolled to show.
  const [t, setT] = useState(still);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active || !visible) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(still);
      return;
    }
    // Every time a scene comes back into view it starts from its first beat.
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setT((now - start) % loopMs);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, visible, loopMs, still]);

  return { ref, t };
}

/** Characters of `text` typed by time `t`, starting at `from`, `ms` apart. */
export function typed(text: string, t: number, from: number, ms = 70) {
  return text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t - from) / ms))));
}

export const between = (t: number, from: number, to: number) => t >= from && t < to;

/**
 * The square-ish ground every scene sits on. `label` describes the whole
 * animation once for assistive technology; the moving parts are hidden.
 */
export function SceneFrame({
  sceneRef,
  name,
  loop,
  label,
  className,
  children,
}: {
  sceneRef: React.RefObject<HTMLDivElement | null>;
  name: string;
  loop: number;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={sceneRef}
      data-scene={name}
      data-loop={loop}
      role="img"
      aria-label={label}
      className={cn('landing-stage @container relative w-full select-none overflow-hidden rounded-[1.5rem] md:rounded-[1.75rem]', className)}
    >
      <div aria-hidden className="absolute inset-0">
        {children}
      </div>
    </div>
  );
}

/**
 * A pointer that glides between positions (percent of the scene) and dips when
 * it presses. `touch` draws a fingertip instead, for the phone scene.
 */
export function Cursor({
  x,
  y,
  pressed = false,
  visible = true,
  touch = false,
  name,
  color,
  ms = 700,
}: {
  x: number;
  y: number;
  pressed?: boolean;
  visible?: boolean;
  touch?: boolean;
  name?: string;
  color?: string;
  ms?: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        opacity: visible ? 1 : 0,
        transition: `left ${ms}ms cubic-bezier(.45,.05,.25,1), top ${ms}ms cubic-bezier(.45,.05,.25,1), opacity 250ms`,
      }}
    >
      {touch ? (
        <span
          className="absolute left-0 top-0 block size-[9cqw] rounded-full border-2 border-white/90 bg-ink/25 shadow-pop transition-transform duration-150"
          style={{ transform: `translate(-50%, -50%) scale(${pressed ? 0.78 : 1})` }}
        />
      ) : (
        <span className="relative block transition-transform duration-150" style={{ transform: `scale(${pressed ? 0.85 : 1})` }}>
          <svg viewBox="0 0 24 24" className="block h-auto w-[4.6cqw] drop-shadow-md" style={{ color: color ?? 'var(--ink)' }}>
            <path d="M4 2.5 19.5 12l-6.6 1.5 3.9 7.2-2.9 1.5-3.8-7.2L4 19.6z" fill="currentColor" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          {name && (
            <span
              className="absolute start-[3.2cqw] top-[4.2cqw] whitespace-nowrap rounded-full px-[1.6cqw] py-[0.4cqw] text-[2.4cqw] font-bold text-white shadow-row"
              style={{ background: color }}
            >
              {name}
            </span>
          )}
        </span>
      )}
      {pressed && (
        <span className="scene-ripple absolute block size-[7cqw] rounded-full border-2" style={{ borderColor: color ?? 'var(--accent)' }} />
      )}
    </div>
  );
}

/** The completion burst: a few dots thrown outward from a checkbox. */
export function Burst({ show }: { show: boolean }) {
  if (!show) return null;
  const dots = [0, 60, 120, 180, 240, 300];
  return (
    <span className="pointer-events-none absolute inset-0">
      {dots.map((deg) => (
        <span
          key={deg}
          className="scene-burst absolute start-1/2 top-1/2 block size-[1.3cqw] rounded-full bg-accent"
          style={{ '--dx': `${Math.cos((deg * Math.PI) / 180) * 5}cqw`, '--dy': `${Math.sin((deg * Math.PI) / 180) * 5}cqw` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

/** A Latin or numeric fragment kept as its own bidi island inside Hebrew. */
export function Ltr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span dir="ltr" className={cn('inline-block [unicode-bidi:isolate]', className)}>
      {children}
    </span>
  );
}
