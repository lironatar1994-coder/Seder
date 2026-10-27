import type { TrackerPeriod } from './tracker';

export interface TrackerRowDTO {
  id: string;
  title: string;
  /** Checked days, by "YYYY-MM-DD", each with its note ('' when none). */
  checks: Record<string, string>;
}

export interface TrackerDTO {
  id: string;
  name: string;
  period: TrackerPeriod;
  weekdays: number[];
  rows: TrackerRowDTO[];
}
