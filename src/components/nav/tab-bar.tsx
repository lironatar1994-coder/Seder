'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SidebarData } from '@/server/tasks/queries';
import { requestCompose } from '@/components/task/compose-bus';

import { COLLECTIONS_LABEL, MOBILE_VIEWS, isDestinationActive, taskCountLabel } from './navigation-model';

const TABS = MOBILE_VIEWS;

// Navigation represents places. Capture remains a separate, persistent action.
export function TabBar({ counts }: { counts: SidebarData['counts'] }) {
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
  const otherView = !TABS.some((tab) => isDestinationActive(tab, pathname));
  if (pathname.startsWith('/app/settings')) return null;
  return <>
    {!browsing && <button type="button" aria-label="הוספת משימה" onClick={compose} className="mobile-add md:hidden"><Plus className="size-7" strokeWidth={2} aria-hidden /></button>}
    <nav aria-label="ניווט מהיר" className={cn('tab-bar fixed inset-be-0 inset-x-0 border-bs border-line bg-paper md:hidden', browsing ? 'z-[55]' : 'z-30')}>
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const { href, tabLabel: label, slug, icon: Icon } = tab;
          const active = isDestinationActive(tab, pathname);
          const count = tab.countKey ? counts[tab.countKey] : 0;
          return <li key={href} className="flex-1"><Link href={href} onClick={() => window.dispatchEvent(new Event('seder:browse-close'))} aria-label={label} aria-describedby={count ? `tab-count-${slug}` : undefined} aria-current={active ? 'page' : undefined} className={cn('mobile-tab', active ? 'text-accent' : 'text-muted')}>
            <span className={cn('mobile-tab-icon relative grid h-8 min-w-11 place-items-center rounded-lg', active && 'bg-accent-soft')}><Icon className="size-[1.375rem]" strokeWidth={active ? 2 : 1.6} aria-hidden />{count > 0 && <span aria-hidden className="mobile-tab-count num absolute inset-bs-0 inset-e-0">{count > 99 ? '99+' : count}</span>}</span>{count > 0 && <span id={`tab-count-${slug}`} className="sr-only">{taskCountLabel(count)}</span>}
            <span className={cn('text-xs leading-none', active && 'font-semibold')}>{label}</span>
          </Link></li>;
        })}
        <li className="flex-1"><button type="button" data-browse-trigger aria-label={COLLECTIONS_LABEL} aria-current={otherView ? 'page' : undefined} aria-expanded={browsing} onClick={() => window.dispatchEvent(new Event('seder:browse'))} className={cn('mobile-tab', browsing || otherView ? 'text-ink' : 'text-muted')}><span className={cn("grid h-8 min-w-11 place-items-center rounded-lg", (browsing || otherView) && "bg-surface-2")}><LayoutGrid className="size-[1.375rem]" strokeWidth={browsing || otherView ? 2 : 1.6} aria-hidden /></span><span className={cn('text-xs leading-none', (browsing || otherView) && 'font-semibold')}>{COLLECTIONS_LABEL}</span></button></li>
      </ul>
    </nav>
  </>;
}
