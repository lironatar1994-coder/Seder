'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, CalendarRange, Inbox, Plus, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SidebarData } from '@/server/tasks/queries';
import { requestCompose } from '@/components/task/compose-bus';

/**
 * Phone navigation, in the thumb arc.
 *
 * The sidebar is the desk answer: eleven destinations, a scan, a pointer. On a
 * phone the same list costs a hamburger, a drawer and a read, for what is
 * overwhelmingly one of four places. Those four sit here permanently, and the
 * drawer keeps everything the phone reaches for rarely — projects, labels,
 * settings, sign-out.
 *
 * Capture gets its own slot rather than a place in the list, because it is the
 * one thing a phone is better at than a desk: the task occurs to you while you
 * are standing somewhere, and it has to cost one tap.
 */

const TABS = [
  { href: '/app/today', label: 'היום', icon: Sun, count: 'today' },
  { href: '/app/upcoming', label: 'בקרוב', icon: CalendarDays, count: 'upcoming' },
  { href: '/app/inbox', label: 'תיבה', icon: Inbox, count: 'inbox' },
  { href: '/app/calendar', label: 'לוח שנה', icon: CalendarRange, count: null },
] as const;

export function TabBar({ counts }: { counts: SidebarData['counts'] }) {
  const pathname = usePathname();
  const router = useRouter();

  /**
   * The composer belongs to the list, so ask it first. On a route with no list
   * — the calendar, settings — send the tap to Today and open it on arrival
   * rather than doing nothing, which is how a capture button loses trust.
   */
  function compose() {
    if (!requestCompose()) router.push('/app/today?compose=1');
  }

  return (
    <nav
      aria-label="ניווט מהיר"
      className={cn(
        'fixed inset-be-0 inset-s-0 inset-e-0 z-30 md:hidden',
        'border-bs border-line bg-paper/95 backdrop-blur',
        // Clears the home indicator. `max()` so a device without one still gets
        // real padding rather than collapsing to the inset's zero.
        'pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5',
      )}
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active =
            tab.href === '/app/calendar'
              ? pathname.startsWith('/app/calendar')
              : pathname === tab.href;
          const count = tab.count ? counts[tab.count] : 0;
          return (
            <li key={tab.href} className="flex-1">
              <Tab {...tab} active={active} count={count} />
            </li>
          );
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={compose}
            // Same footprint as a tab, so the row stays an even rhythm; the
            // accent is what marks it as the primary act, not a bigger box.
            className={cn(
              'group flex h-full w-full flex-col items-center justify-center gap-1 px-1 pb-1 pt-1.5',
              'text-accent transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
            )}
          >
            <span className="grid size-7 place-items-center rounded-full bg-accent text-on-accent transition-transform duration-150 group-active:scale-90">
              <Plus className="size-4" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-[0.6875rem] font-semibold leading-none">חדשה</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
  count,
}: {
  href: string;
  label: string;
  icon: typeof Sun;
  active: boolean;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // 44px of height before padding — the whole cell is the target, not the
        // glyph inside it.
        'flex h-full min-h-11 w-full flex-col items-center justify-center gap-1 px-1 pb-1 pt-1.5',
        'transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
        active ? 'text-accent' : 'text-muted',
      )}
    >
      <span className="relative">
        <Icon className="size-[1.375rem]" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
        {count > 0 && (
          <span
            // A count, not a dot: "4 waiting" and "something waiting" are
            // different facts, and the sidebar already tells the truth.
            className={cn(
              'num absolute inset-bs-[-0.4rem] inset-s-[-0.65rem] min-w-[1.05rem] rounded-full px-1',
              'text-center text-[0.625rem] font-bold leading-[1.05rem]',
              // The badge sits partly over the glyph — there is no room beside
              // it — so it carries a ring in the bar's own colour to read as an
              // object in front rather than as a collision. The day rail's
              // marker solves the same problem the same way.
              'ring-2 ring-[var(--paper)]',
              active ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2',
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className={cn('text-[0.6875rem] leading-none', active && 'font-semibold')}>
        {label}
      </span>
    </Link>
  );
}
