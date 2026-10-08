'use client';
import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Search, Keyboard, ChevronLeft, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import type { SidebarData } from '@/server/tasks/queries';
import { workspaceLocation } from './navigation-model';

export function WorkspaceBar({ data }: { data: SidebarData }) {
  const pathname = usePathname(); const params = useSearchParams(); const [help, setHelp] = useState(false);
  const { label: place, parent } = workspaceLocation(pathname, params.get('id'), data);
  return <><div className="workspace-bar hidden md:flex"><span className="flex min-w-0 items-center gap-2 text-sm text-muted"><ListFilter className="size-4" aria-hidden /><span>{parent}</span><ChevronLeft className="size-3" aria-hidden /><span className="truncate font-semibold text-ink-2">{place}</span></span><div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => window.dispatchEvent(new Event('seder:search'))}><Search className="size-4" aria-hidden />חיפוש <kbd className="num ms-3 text-xs text-muted">Ctrl K</kbd></Button><Button variant="ghost" size="sm" aria-label="קיצורי מקלדת" onClick={() => setHelp(true)}><Keyboard className="size-4" aria-hidden /></Button></div></div><Dialog open={help} onOpenChange={setHelp}><DialogContent title="קיצורי מקלדת" description="אפשר להגיע לכל פעולה גם בעזרת העכבר או המגע."><dl className="space-y-3">{[['Ctrl / ⌘ K', 'חיפוש משימות ומעבר בין תצוגות'], ['N', 'משימה חדשה'], ['↑ / ↓', 'מעבר בין משימות'], ['Enter', 'פתיחת פרטי המשימה'], ['Space', 'השלמת משימה'], ['Ctrl / ⌘ A', 'בחירת כל המשימות'], ['X', 'הוספת משימה לבחירה'], ['Escape', 'סגירה או ביטול בחירה']].map(([key, label]) => <div className="flex items-center justify-between gap-4" key={key}><dt className="text-sm">{label}</dt><dd><kbd className="num rounded-md bg-surface-2 px-2 py-1 text-xs">{key}</kbd></dd></div>)}</dl></DialogContent></Dialog></>;
}
