'use client';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import type { SidebarData } from '@/server/tasks/queries';
import { workspaceLocation } from './navigation-model';

export function WorkspaceBar({ data }: { data: SidebarData }) {
  const pathname = usePathname(); const params = useSearchParams(); const [help, setHelp] = useState(false);
  /* The shortcut list opens from the account menu or with "?", as in Todoist,
     instead of a lone keyboard icon in the corner of every page. */
  useEffect(() => {
    const open = () => setHelp(true);
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '?' || event.ctrlKey || event.metaKey || target?.closest('input, textarea, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      setHelp(true);
    };
    window.addEventListener('seder:shortcuts', open);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('seder:shortcuts', open); window.removeEventListener('keydown', key); };
  }, []);
  const { label: place, parent } = workspaceLocation(pathname, params.get('id'), data);
  return <><div className="workspace-bar hidden md:flex">{/* Todoist shows a trail only inside something — "My Projects / Home" — never
        above a top-level list whose name is the heading right under it. */}
    {parent === 'המשימות שלי' ? <span /> : <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted"><span>{parent}</span><ChevronLeft className="size-3" aria-hidden /><span className="truncate text-ink-2">{place}</span></span>}</div><Dialog open={help} onOpenChange={setHelp}><DialogContent title="קיצורי מקלדת" description="אפשר להגיע לכל פעולה גם בעזרת העכבר או המגע."><dl className="space-y-3">{[['Ctrl / ⌘ K', 'חיפוש משימות ומעבר בין תצוגות'], ['N', 'משימה חדשה'], ['↑ / ↓', 'מעבר בין משימות'], ['Enter', 'פתיחת פרטי המשימה'], ['Space', 'השלמת משימה'], ['Ctrl / ⌘ A', 'בחירת כל המשימות'], ['X', 'הוספת משימה לבחירה'], ['Escape', 'סגירה או ביטול בחירה'], ['?', 'רשימת הקיצורים הזו']].map(([key, label]) => <div className="flex items-center justify-between gap-4" key={key}><dt className="text-sm">{label}</dt><dd><kbd className="num rounded-md bg-surface-2 px-2 py-1 text-xs">{key}</kbd></dd></div>)}</dl></DialogContent></Dialog></>;
}
