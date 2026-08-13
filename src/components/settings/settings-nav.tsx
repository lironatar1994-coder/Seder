'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * The settings sections.
 *
 * A column from `md` up, where there is room for one and where it reads as a
 * table of contents; a scrolling strip below that, where a column would eat
 * half the screen before the first control.
 *
 * The current section is filled rather than underlined. An underline is right
 * for tabs sitting on the edge of the thing they introduce; a column is beside
 * its content, not above it, so the marker has to be the row itself.
 */
export function SettingsNav({
  sections,
}: {
  sections: readonly { slug: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="מקטעי הגדרות"
      className="border-be border-line md:sticky md:inset-bs-6 md:border-be-0"
    >
      <ul className="scroll-quiet -mb-px flex gap-1 overflow-x-auto md:mb-0 md:flex-col md:gap-0.5 md:overflow-visible">
        {sections.map((section) => {
          const href = `/app/settings/${section.slug}`;
          const active = pathname === href;
          return (
            <li key={section.slug}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                style={active ? { viewTransitionName: 'section-current' } : undefined}
                className={cn(
                  'inline-flex items-center whitespace-nowrap text-sm transition-colors duration-150',
                  '[@media(pointer:coarse)]:min-h-11',
                  // Strip below md: a rule under the current one.
                  'border-be-2 px-3 py-2.5',
                  // Column from md: a filled row, full width, no rule.
                  'md:w-full md:rounded-lg md:border-be-0 md:px-3 md:py-2',
                  active
                    ? 'border-accent font-semibold text-ink md:bg-accent-soft md:text-accent'
                    : 'border-transparent text-muted hover:border-line-strong hover:text-ink md:hover:border-transparent md:hover:bg-surface-2',
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
