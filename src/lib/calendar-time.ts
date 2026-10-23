/** Time-of-day arithmetic for the calendar's hour grid.
 *
 *  Everything is minutes since midnight, Israel time. Task times are stored as
 *  naive "HH:mm" strings, already local; Google events arrive as instants and
 *  are converted here, so both kinds share one axis.
 */

export const MINUTES_IN_DAY = 24 * 60;
/** Height of one hour row. Tall enough for a 30-minute block to hold a title. */
export const HOUR_PX = 52;
export const PX_PER_MINUTE = HOUR_PX / 60;
/** Drops and resizes land on the quarter hour. */
export const SNAP_MINUTES = 15;
/** A block shorter than this could not show its own title. */
export const MIN_BLOCK_MINUTES = 15;

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMinutes(time: string): number | null {
  const match = CLOCK.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function fromMinutes(minutes: number): string {
  const clamped = Math.min(Math.max(Math.round(minutes), 0), MINUTES_IN_DAY - 1);
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export function snapMinutes(minutes: number, step = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

/** A start that keeps a block of `duration` inside the day. */
export function clampStart(minutes: number, duration = MIN_BLOCK_MINUTES): number {
  return Math.min(Math.max(minutes, 0), MINUTES_IN_DAY - Math.min(duration, MINUTES_IN_DAY));
}

/** "09:00–10:30". Written start-first; the bidi algorithm keeps digits LTR. */
export function formatRange(start: number, end: number): string {
  return `${fromMinutes(start)}–${fromMinutes(Math.min(end, MINUTES_IN_DAY - 1))}`;
}

const jerusalemClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Minutes since midnight in Israel for an instant. */
export function jerusalemMinutes(instant: Date | string): number {
  const parts = jerusalemClock.formatToParts(typeof instant === 'string' ? new Date(instant) : instant);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export interface Span {
  start: number;
  end: number;
}

export interface Placed<T> {
  item: T;
  /** Column within its overlap cluster, from the inline-start. */
  lane: number;
  /** How many columns the cluster needs. */
  lanes: number;
}

/**
 * Side-by-side placement for overlapping blocks.
 *
 * Blocks that overlap, directly or through a chain, form a cluster; each takes
 * the first lane free at its start and the cluster is divided evenly between
 * its lanes. That is how every calendar does it, and it keeps two meetings at
 * the same hour both readable instead of one hiding the other.
 */
export function layoutSpans<T extends Span>(items: T[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const close = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    // A visible block is at least MIN_BLOCK_MINUTES tall, so it occupies that
    // much of the axis even when the task itself is shorter.
    const end = Math.max(item.end, item.start + MIN_BLOCK_MINUTES);
    if (item.start >= clusterEnd) close();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }

    const entry = { item, lane, lanes: 1 };
    cluster.push(entry);
    placed.push(entry);
    clusterEnd = Math.max(clusterEnd, end);
  }
  close();
  return placed;
}
