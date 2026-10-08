'use client';

import { CalendarDays, CalendarSearch, CalendarX2, Layers, Moon, Sun } from 'lucide-react';
import { MenuItem } from '@/components/ui/overlays';
import { addDays, today, weekdayName } from '@/lib/dates';
import { dateTone } from '@/lib/date-presentation';
import { useTaskNow } from './task-clock';
import type { ReschedulePreset } from '@/lib/reschedule';

export interface WhenSelection {
  bucket: string;
  date?: string | null;
  preset?: ReschedulePreset | null;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** The scheduling answers Things gives you, in the order you reach for them.
 *  Rendered inside an existing Menu, hence the bare items.
 *
 *  `onMore` opens the full picker. It lives in the detail panel rather than
 *  nested inside this dropdown: a popover inside a menu fights the menu's own
 *  focus trap, and the calendar is the wrong size for a menu anyway. */
export function WhenMenuItems({
  onSelect,
  onMore,
}: {
  onSelect: (when: WhenSelection) => void;
  onMore?: () => void;
}) {
  const now = useTaskNow();
  const base = today(now);
  const tomorrow = addDays(base, 1);
  // "Next week" means the coming Sunday — the Israeli week starts there.
  const nextWeek = addDays(base, ((0 - base.getUTCDay() + 7) % 7) || 7);

  return (
    <>
      <MenuItem data-date-tone="today" onSelect={() => onSelect({ bucket: 'SCHEDULED', date: iso(base), preset: 'today' })}>
        <Sun className="size-4" aria-hidden />
        <span className="flex-1">היום</span>
      </MenuItem>
      <MenuItem data-date-tone="tomorrow" onSelect={() => onSelect({ bucket: 'SCHEDULED', date: iso(tomorrow), preset: 'tomorrow' })}>
        <CalendarDays className="size-4" aria-hidden />
        <span className="flex-1">מחר</span>
        <span className="text-xs text-muted">{weekdayName(tomorrow)}</span>
      </MenuItem>
      <MenuItem data-date-tone={dateTone(nextWeek, now)} onSelect={() => onSelect({ bucket: 'SCHEDULED', date: iso(nextWeek), preset: 'next-week' })}>
        <CalendarDays className="size-4" aria-hidden />
        <span className="flex-1">שבוע הבא</span>
        <span className="text-xs text-muted">{weekdayName(nextWeek)}</span>
      </MenuItem>
      <MenuItem onSelect={() => onSelect({ bucket: 'ANYTIME' })}>
        <Layers className="size-4 text-muted" aria-hidden />
        <span className="flex-1">בכל עת</span>
      </MenuItem>
      <MenuItem onSelect={() => onSelect({ bucket: 'SOMEDAY' })}>
        <Moon className="size-4 text-muted" aria-hidden />
        <span className="flex-1">מתישהו</span>
      </MenuItem>
      <MenuItem onSelect={() => onSelect({ bucket: 'ANYTIME' })}>
        <CalendarX2 className="size-4 text-muted" aria-hidden />
        <span className="flex-1">ללא תאריך</span>
      </MenuItem>
      {onMore && (
        <MenuItem onSelect={onMore}>
          <CalendarSearch className="size-4 text-muted" aria-hidden />
          <span className="flex-1">תאריך אחר…</span>
        </MenuItem>
      )}
    </>
  );
}
