'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/** Desktop section directory; compact screens use the overview and header links. */
export function SettingsNav({
  sections,
}: {
  sections: readonly { slug: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="מקטעי הגדרות"
      className="hidden lg:sticky lg:inset-bs-[9rem] lg:block"
    >
      <ul className="flex flex-col gap-0.5">
        {sections.map((section) => {
          const href = `/app/settings/${section.slug}`;
          const active = pathname === href;
          return (
            <li key={section.slug}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center whitespace-nowrap text-sm transition-colors duration-150',
                  '[@media(pointer:coarse)]:min-h-11',
                  'w-full rounded-lg px-3 py-2',
                  active
                    ? 'bg-accent-soft font-semibold text-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-ink',
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
