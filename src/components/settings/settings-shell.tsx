'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, X } from 'lucide-react';
import { useWorkspaceReturn } from '@/components/nav/workspace-return';
import { SettingsNav } from './settings-nav';
import { SETTINGS_SECTIONS } from './sections';

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = SETTINGS_SECTIONS.find(item => pathname === `/app/settings/${item.slug}`);
  const returnTo = useWorkspaceReturn();
  return <div data-wide data-settings-shell className="settings-shell pb-10">
    <header className="settings-header">
      <div className="flex items-center justify-between gap-3">
        {section ? <Link href="/app/settings" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-accent"><ChevronRight className="size-4" aria-hidden />כל ההגדרות</Link> : <span className="text-sm text-muted">סדר</span>}
        <Link href={returnTo} aria-label="חזרה למשימות" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-2 hover:bg-surface-2">
          <span>חזרה למשימות</span><X className="size-4" aria-hidden />
        </Link>
      </div>
      <h1 className="mt-2 text-[1.75rem] font-bold leading-tight text-ink md:text-[2rem]">{section?.label ?? 'הגדרות'}</h1>
    </header>
    <div className={section ? 'gap-10 lg:grid lg:grid-cols-[13rem_minmax(0,44rem)] lg:items-start' : 'max-w-[44rem]'}>
      {section && <SettingsNav sections={SETTINGS_SECTIONS} />}
      <div className="min-w-0" data-settings-content>{children}</div>
    </div>
  </div>;
}
