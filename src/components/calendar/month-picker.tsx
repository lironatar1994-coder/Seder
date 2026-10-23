'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { monthName } from '@/lib/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';

/**
 * The view's title doubles as a jump: "אוקטובר 2026 ⌄" opens the year's
 * months, the way Todoist's month heading does.
 */
export function MonthPicker({
  month,
  year,
  currentMonth,
  currentYear,
  hrefFor,
}: {
  /** 0-based month on screen. */
  month: number;
  year: number;
  /** Today's month, marked in the grid. */
  currentMonth: number;
  currentYear: number;
  hrefFor: (anchor: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [shownYear, setShownYear] = useState(year);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setShownYear(year);
      }}
    >
      <PopoverTrigger
        className="group/title -ms-1.5 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-surface-2"
        aria-label={`בחירת חודש — ${monthName(month)} ${year}`}
      >
        <span className="text-xl font-bold text-ink md:text-2xl">{monthName(month)}</span>
        <span className="num text-xl font-normal text-ink-2 md:text-2xl">{year}</span>
        <ChevronDown
          className="size-4 text-muted transition-transform group-data-[state=open]/title:rotate-180"
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between">
          {/* Earlier sits at the start of the line — the right, in Hebrew. */}
          <button
            type="button"
            onClick={() => setShownYear((y) => y - 1)}
            aria-label="השנה הקודמת"
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <span className="num text-sm font-bold text-ink">{shownYear}</span>
          <button
            type="button"
            onClick={() => setShownYear((y) => y + 1)}
            aria-label="השנה הבאה"
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 12 }, (_, index) => {
            const anchor = `${shownYear}-${String(index + 1).padStart(2, '0')}`;
            const selected = shownYear === year && index === month;
            const current = shownYear === currentYear && index === currentMonth;
            return (
              <Link
                key={anchor}
                href={hrefFor(anchor)}
                onClick={() => setOpen(false)}
                aria-current={selected ? 'date' : undefined}
                className={cn(
                  'rounded-md px-2 py-2 text-center text-sm transition-colors',
                  selected
                    ? 'bg-accent font-bold text-[var(--on-accent)]'
                    : current
                      ? 'font-bold text-accent hover:bg-accent-soft'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                {monthName(index)}
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
