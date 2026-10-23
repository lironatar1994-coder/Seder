'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * On a phone the header button is small and far from the thumb. Once the hero's
 * own button has scrolled away, a full-width one waits at the bottom edge — and
 * steps aside again when the closing call to action is on screen.
 */
export function MobileCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.querySelector('[data-hero-cta]');
    const closing = document.querySelector('[data-closing-cta]');
    if (!hero || !closing) return;
    const seen = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target, entry.isIntersecting);
      setShow(!seen.get(hero) && !seen.get(closing) && hero.getBoundingClientRect().top < 0);
    });
    observer.observe(hero);
    observer.observe(closing);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-transform duration-300 md:hidden',
        show ? 'translate-y-0' : 'translate-y-full',
      )}
    >
      <Link href="/register" tabIndex={show ? 0 : -1} className="flex h-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-[var(--on-accent)]">
        להתחיל בחינם
      </Link>
    </div>
  );
}
