'use client';

import { createContext, useContext } from 'react';
import type { TaskDTO } from '@/server/tasks/queries';

/** Where a click-to-add landed: the day, the slot (week grid only) and the
 *  pointer, which the popover anchors to. */
export interface QuickAddDraft {
  iso: string;
  time: string | null;
  x: number;
  y: number;
}

/**
 * What every chip, block and cell needs from the calendar, without threading
 * it through the month grid, the week grid and the tray separately.
 */
export interface CalendarActions {
  openTask: (taskId: string) => void;
  toggleTask: (task: TaskDTO) => void;
  /** Ticked here and not yet confirmed by the server. */
  completing: ReadonlySet<string>;
  setDuration: (taskId: string, minutes: number) => void;
  quickAdd: (draft: QuickAddDraft) => void;
  draft: QuickAddDraft | null;
}

const Context = createContext<CalendarActions | null>(null);

export const CalendarActionsProvider = Context.Provider;

export function useCalendarActions(): CalendarActions {
  const value = useContext(Context);
  if (!value) throw new Error('useCalendarActions outside the calendar');
  return value;
}
