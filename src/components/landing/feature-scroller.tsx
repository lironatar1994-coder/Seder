'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { LoopVideo } from './loop-video';

export interface FeatureStep {
  id: string;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  clip: string;
  clipLabel: string;
  /** Width / height of the recording, so the frame hugs it exactly. */
  aspect: number;
}

/**
 * The scroll-driven feature tour: copy scrolls on the inline-start side while
 * one sticky stage on the other side swaps to the matching recording. Below
 * `lg` there is no room for a sticky column, so each step simply carries its
 * own recording under its copy.
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
    // A thin band across the middle of the viewport: whichever step is
    // crossing it owns the stage.
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
    <div className="lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
      <ol className="space-y-20 lg:space-y-0">
        {steps.map((step) => (
          <li
            key={step.id}
            data-step={step.id}
            ref={(node) => {
              if (node) refs.current.set(step.id, node);
            }}
            className="lg:flex lg:min-h-[78vh] lg:flex-col lg:justify-center"
          >
            <p className="text-sm font-bold text-accent">{step.eyebrow}</p>
            <h3
              className={cn(
                'mt-3 text-3xl font-extrabold leading-tight text-ink transition-colors duration-300 md:text-[2.5rem]',
                wide && active !== step.id && 'lg:text-muted',
              )}
            >
              {step.title}
            </h3>
            <div className="mt-4 max-w-md text-lg leading-relaxed text-ink-2">{step.body}</div>
            {!wide && (
              <Stage className="mt-8">
                <Frame step={step}>
                  <LoopVideo name={step.clip} label={step.clipLabel} />
                </Frame>
              </Stage>
            )}
          </li>
        ))}
      </ol>

      {wide && (
        <div className="relative">
          <div className="sticky top-[calc(50vh-16.5rem)]">
            <Stage className="aspect-[1.18] w-full">
              {steps.map((step) => (
                <div
                  key={step.id}
                  aria-hidden={active !== step.id}
                  className={cn(
                    'absolute inset-0 grid place-items-center p-[7%] transition-[opacity,transform] duration-500 ease-out',
                    active === step.id ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
                  )}
                >
                  <Frame step={step}>
                    <LoopVideo name={step.clip} label={step.clipLabel} active={active === step.id} />
                  </Frame>
                </div>
              ))}
            </Stage>
          </div>
        </div>
      )}
    </div>
  );
}

/** The warm ground the recordings sit on — the page's one decorative surface. */
export function Stage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('landing-stage relative overflow-hidden rounded-[1.75rem] p-[6%]', className)}>{children}</div>;
}

function Frame({ step, children }: { step: FeatureStep; children: React.ReactNode }) {
  return (
    <div
      className="w-full overflow-hidden rounded-xl bg-paper shadow-pop ring-1 ring-line"
      style={{ aspectRatio: step.aspect }}
    >
      {children}
    </div>
  );
}
