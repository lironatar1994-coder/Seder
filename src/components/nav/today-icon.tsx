'use client';

import { forwardRef, type SVGProps } from 'react';
import { today } from '@/lib/dates';

/**
 * Todoist's small touch: the Today icon is a calendar page showing today's
 * date, so the sidebar answers "what day is it" before anything is opened.
 * Same 24-unit box and stroke as the lucide icons beside it.
 */
export const TodayIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>(function TodayIcon(
  { strokeWidth = 1.7, ...props },
  ref,
) {
  const day = today().getUTCDate();
  return (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9h17M8 2.75v3.5M16 2.75v3.5" />
      <text x="12" y="18.4" textAnchor="middle" fontSize="8.6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, system-ui, sans-serif" direction="ltr">
        {day}
      </text>
    </svg>
  );
});
