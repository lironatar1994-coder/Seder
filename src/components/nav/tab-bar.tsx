'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, Inbox, Menu, Plus, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SidebarData } from '@/server/tasks/queries';
import { requestCompose } from '@/components/task/compose-bus';

const TABS = [
  { href: '/app/inbox', label: 'תיבה', icon: Inbox },
  { href: '/app/today', label: 'היום', icon: Sun },
  { href: '/app/upcoming', label: 'בקרוב', icon: CalendarDays },
] as const;

// Navigation represents places. Capture remains a separate, persistent action.
export function TabBar({ counts: _counts }: { counts: SidebarData['counts'] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [browsing, setBrowsing] = useState(false);
  useEffect(() => {
    const receive = (event: Event) => setBrowsing((event as CustomEvent<boolean>).detail);
    window.addEventListener('seder:browse-state', receive);
    return () => window.removeEventListener('seder:browse-state', receive);
  }, []);
  function compose() {
    if (!requestCompose()) router.push('/app/today?compose=1');
  }
  const otherView = !TABS.some((tab) => pathname === tab.href);
  return <>
    {!browsing && <button type="button" aria-label="הוספת משימה" onClick={compose} className="mobile-add md:hidden"><Plus className="size-7" strokeWidth={2} aria-hidden /></button>}
    <nav aria-label="ניווט מהיר" className={cn('tab-bar fixed inset-be-0 inset-x-0 border-bs border-line bg-paper md:hidden', browsing ? 'z-[55]' : 'z-30')}>
      <ul className="flex items-stretch">
        {TABS.map(({href, label, icon: Icon}) => {
          const active = !browsing && pathname === href;
          return <li key={href} className="flex-1"><Link href={href} onClick={() => window.dispatchEvent(new Event('seder:browse-close'))} aria-current={active ? 'page' : undefined} className={cn('mobile-tab', active ? 'text-accent' : 'text-muted')}>
            <Icon className="size-[1.375rem]" strokeWidth={active ? 2 : 1.6} aria-hidden />
            <span className={cn('text-xs leading-none', active && 'font-semibold')}>{label}</span>
          </Link></li>;
        })}
        <li className="flex-1"><button type="button" data-browse-trigger aria-label="תפריט" aria-expanded={browsing} onClick={() => window.dispatchEvent(new Event('seder:browse'))} className={cn('mobile-tab', browsing || otherView ? 'text-accent' : 'text-muted')}><Menu className="size-[1.375rem]" strokeWidth={1.6} aria-hidden /><span className="text-xs leading-none">עיון</span></button></li>
      </ul>
    </nav>
  </>;
}
