'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { CalendarScene, CaptureScene, FocusScene, TogetherScene } from './scenes';

const SCENES = { capture: CaptureScene, focus: FocusScene, calendar: CalendarScene, together: TogetherScene };

export interface FeatureStep {
  id: string;
  eyebrow: string;
  title: string;
  line: string;
  scene: keyof typeof SCENES;
}

/**
 * Todoist's scroll-driven tour: on a wide screen the copy scrolls on one side
 * while a sticky stage on the other plays the matching scene. On a phone there
 * is no room for a sticky column, so each step is a short headline followed by
 * its own scene, full width.
 */
export function FeatureScroller({ steps }: { steps: FeatureStep[] }) {
  const [active, setActive] = useState(steps[0].id);
  const [wide, setWide] = useState(false);
  const refs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    // Whichever step crosses the middle of the viewport owns the stage.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.step!);
        }
      },
      { rootMargin: '-48% 0px -48% 0px' },
    );
    refs.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
      <ol className="space-y-16 lg:space-y-0">
        {steps.map((step) => {
          const Scene = SCENES[step.scene];
          return (
            <li
              key={step.id}
              data-step={step.id}
              ref={(node) => {
                if (node) refs.current.set(step.id, node);
              }}
              className="lg:flex lg:min-h-[72vh] lg:flex-col lg:justify-center"
            >
              <p className="text-sm font-bold text-accent">{step.eyebrow}</p>
              <h3
                className={cn(
                  'mt-2 text-[2rem] font-extrabold leading-[1.1] text-ink transition-colors duration-300 lg:text-5xl',
                  wide && active !== step.id && 'lg:text-line-strong',
                )}
              >
                {step.title}
              </h3>
              <p className="mt-3 text-lg text-ink-2 lg:text-xl">{step.line}</p>
              {!wide && (
                <div className="mt-6">
                  <Scene />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {wide && (
        <div className="relative">
          <div className="sticky top-[calc(50vh-17rem)] aspect-[1.12] w-full">
            {steps.map((step) => {
              const Scene = SCENES[step.scene];
              const on = active === step.id;
              return (
                <div
                  key={step.id}
                  aria-hidden={!on}
                  className={cn(
                    'absolute inset-0 transition-[opacity,transform] duration-500 ease-out',
                    on ? 'opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
                  )}
                >
                  <Scene active={on} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
