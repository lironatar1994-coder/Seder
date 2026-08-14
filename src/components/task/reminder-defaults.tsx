'use client';

import { createContext, useContext } from 'react';

/**
 * The account's reminder defaults, for the controls that describe them.
 *
 * A context rather than a prop, because the only consumer is the reminder
 * picker inside the task editor — which is rendered from the task list and
 * from the calendar, each reached from four different pages. Threading one
 * number through six components so a label can read "ברירת מחדל · 08:00"
 * instead of "ברירת מחדל" is a poor trade; the provider is mounted once, in
 * the authenticated layout, next to the query that already loads the user.
 */

export interface ReminderDefaults {
  /** `User.reminderHour` — when an untimed task's reminder fires. */
  hour: number;
  /** Minutes before a timed task, when the task itself says nothing. */
  lead: number;
}

const FALLBACK: ReminderDefaults = { hour: 8, lead: 15 };

const Context = createContext<ReminderDefaults>(FALLBACK);

export function ReminderDefaultsProvider({
  value,
  children,
}: {
  value: ReminderDefaults;
  children: React.ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReminderDefaults(): ReminderDefaults {
  return useContext(Context);
}
