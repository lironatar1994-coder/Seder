'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/** Section tabs. The active one carries a solid rule under it rather than a
 *  pill, so the strip stays quiet next to the content it introduces. */
export function SettingsNav({
  sections,
}: {
  sections: readonly { slug: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="מקטעי הגדרות" className="border-be border-line">
      <ul className="scroll-quiet -mb-px flex gap-1 overflow-x-auto">
        {sections.map((section) => {
          const href = `/app/settings/${section.slug}`;
          const active = pathname === href;
          return (
            <li key={section.slug}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-block whitespace-nowrap border-be-2 px-3 py-2.5 text-sm transition-colors duration-150',
                  active
                    ? 'border-accent font-semibold text-ink'
                    : 'border-transparent text-muted hover:border-line-strong hover:text-ink',
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
