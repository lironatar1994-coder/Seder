'use client';

import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/overlays';
import { Composer } from '@/components/task/composer';
import { parseISODay } from '@/lib/calendar';
import { relativeDayLabel, today, weekdayName } from '@/lib/dates';
import { hebrewDayMonth } from '@/lib/hebrew-date';
import { monthName } from '@/lib/calendar';
import type { QuickAddDraft } from './calendar-context';

/**
 * Click a day, or an hour, and the composer opens right there with that day
 * (and hour) already chosen — Todoist's in-place add, rather than a trip to a
 * side panel.
 */
export function QuickAddPopover({
  draft,
  projects,
  labels,
  onClose,
}: {
  draft: QuickAddDraft | null;
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  onClose: () => void;
}) {
  // Radix positions against anything with a bounding rect; the click point is
  // the most honest anchor for a cell that may be half off screen.
  const anchor = useMemo(
    () =>
      draft
        ? { current: { getBoundingClientRect: () => DOMRect.fromRect({ x: draft.x, y: draft.y, width: 0, height: 0 }) } }
        : null,
    [draft],
  );

  if (!draft || !anchor) return null;

  const date = parseISODay(draft.iso);
  const relative = relativeDayLabel(date, today());
  const weekday = weekdayName(date);
  // "היום" and "מחר" are worth saying; any other relative label is just the
  // date again in a different format.
  const near = ['היום', 'מחר', 'אתמול'].includes(relative) ? `${relative}, ` : '';
  const heading = `${near}${weekday} ${date.getUTCDate()} ב${monthName(date.getUTCMonth())}`;

  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        key={`${draft.iso}:${draft.time}`}
        side="bottom"
        align="center"
        sideOffset={10}
        aria-label={`משימה חדשה ל${heading}`}
        className="w-[min(30rem,calc(100vw-2rem))] p-0"
        // The composer's own pickers open popovers of their own; a click in one
        // of those must not count as "outside" and close this.
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-radix-popper-content-wrapper]')) event.preventDefault();
        }}
      >
        <div className="flex items-baseline gap-2 border-be border-line px-4 pb-2.5 pt-3">
          <span className="text-sm font-bold text-ink">{heading}</span>
          <span className="text-xs text-muted">{hebrewDayMonth(date)}</span>
          {draft.time && (
            <span className="num ms-auto inline-flex items-center gap-1 text-xs font-semibold text-accent">
              <Clock className="size-3.5" aria-hidden />
              {draft.time}
            </span>
          )}
        </div>
        <div className="p-2">
          <Composer
            context={{ view: 'calendar', defaultDate: draft.iso, defaultTime: draft.time }}
            projects={projects}
            vocabulary={{ projects: projects.map((p) => p.name), labels: labels.map((l) => l.name) }}
            onClose={onClose}
            onAdded={onClose}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
