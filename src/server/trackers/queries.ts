import 'server-only';
import { db } from '@/server/db';
import { canUseProject } from '@/server/access';
import { dayKey, isTrackerPeriod, parseWeekdays } from '@/lib/tracker';
import type { TrackerDTO } from '@/lib/tracker-types';

/**
 * Every habit table in a project, with all of its checks.
 *
 * All checks, not a window: a cell is a date and an optional note, a busy
 * yearly table is a few thousand of them, and having them all on the client
 * is what lets paging between weeks and months happen without a round trip.
 */
export async function getProjectTrackers(userId: string, projectId: string): Promise<TrackerDTO[]> {
  if (!(await canUseProject(userId, projectId))) return [];
  const trackers = await db.tracker.findMany({
    where: { projectId },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      name: true,
      period: true,
      weekdays: true,
      rows: {
        orderBy: { position: 'asc' },
        select: { id: true, title: true, checks: { select: { day: true, note: true } } },
      },
    },
  });
  return trackers.map((tracker) => ({
    id: tracker.id,
    name: tracker.name,
    period: isTrackerPeriod(tracker.period) ? tracker.period : 'WEEK',
    weekdays: parseWeekdays(tracker.weekdays),
    rows: tracker.rows.map((row) => ({
      id: row.id,
      title: row.title,
      checks: Object.fromEntries(row.checks.map((check) => [dayKey(check.day), check.note ?? ''])),
    })),
  }));
}
