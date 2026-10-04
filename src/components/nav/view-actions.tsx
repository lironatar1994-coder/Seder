'use client';
import Link from 'next/link';
import { CalendarRange, MoreHorizontal, Search, Timer, BookCheck } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/overlays';

export function ViewActions({ planning = false }: { planning?: boolean }) {
  return <>
    <IconButton label="חיפוש" onClick={() => window.dispatchEvent(new Event('seder:search'))}><Search className="size-[1.125rem]" aria-hidden /></IconButton>
    {planning && <Menu><MenuTrigger asChild><IconButton label="אפשרויות היום"><MoreHorizontal className="size-5" aria-hidden /></IconButton></MenuTrigger>
      <MenuContent align="end">
        <MenuItem asChild><Link href="/app/focus"><Timer className="size-4" aria-hidden />מיקוד ותכנון</Link></MenuItem>
        <MenuItem asChild><Link href="/app/calendar"><CalendarRange className="size-4" aria-hidden />לוח שנה</Link></MenuItem>
        <MenuItem asChild><Link href="/app/logbook"><BookCheck className="size-4" aria-hidden />משימות שהושלמו</Link></MenuItem>
      </MenuContent>
    </Menu>}
  </>;
}
