'use client';

import { CalendarDays, CalendarSearch, Layers, Moon, Sun } from 'lucide-react';
import { MenuItem } from '@/components/ui/overlays';
import { addDays, today, weekdayName } from '@/lib/dates';

export interface WhenSelection {
  bucket: string;
  date?: string | null;
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
  const base = today();
  const tomorrow = addDays(base, 1);
  // "Next week" means the coming Sunday — the Israeli week starts there.
  const nextWeek = addDays(base, ((0 - base.getUTCDay() + 7) % 7) || 7);

  return (
    <>
      <MenuItem onSelect={() => onSelect({ bucket: 'SCHEDULED', date: iso(base) })}>
        <Sun className="size-4 text-muted" aria-hidden />
        <span className="flex-1">היום</span>
      </MenuItem>
      <MenuItem onSelect={() => onSelect({ bucket: 'SCHEDULED', date: iso(tomorrow) })}>
        <CalendarDays className="size-4 text-muted" aria-hidden />
        <span className="flex-1">מחר</span>
        <span className="text-xs text-muted">{weekdayName(tomorrow)}</span>
      </MenuItem>
      <MenuItem onSelect={() => onSelect({ bucket: 'SCHEDULED', date: iso(nextWeek) })}>
        <CalendarDays className="size-4 text-muted" aria-hidden />
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
      {/* No separate "no date" entry: now that the Inbox is decided by
          filing rather than by timing, "בכל עת" *is* the undated state. */}
      {onMore && (
        <MenuItem onSelect={onMore}>
          <CalendarSearch className="size-4 text-muted" aria-hidden />
          <span className="flex-1">תאריך אחר…</span>
        </MenuItem>
      )}
    </>
  );
}
