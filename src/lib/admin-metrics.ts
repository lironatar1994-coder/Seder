const DAY = 86_400_000;
const LOCAL_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });

export interface ActivityHour { kind: string; hour: number | bigint; count: number | bigint }

/** Bucketing in Jerusalem handles the midnight boundary and daylight saving. */
export function buildActivityDays(hours: ActivityHour[], now = new Date(), length = 14) {
  const today = LOCAL_DAY.format(now);
  const calendarAnchor = new Date(`${today}T12:00:00Z`).getTime();
  const days = Array.from({ length }, (_, index) => {
    const date = new Date(calendarAnchor - (length - index - 1) * DAY);
    return { key: LOCAL_DAY.format(date), date, created: 0, completed: 0 };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));
  for (const row of hours) {
    const day = byKey.get(LOCAL_DAY.format(new Date(Number(row.hour) * 3_600_000)));
    if (!day) continue;
    if (row.kind === 'created') day.created += Number(row.count);
    if (row.kind === 'completed') day.completed += Number(row.count);
  }
  return days;
}

export function normalizeAdminQuery(search?: string, page?: string) {
  return { search: (search ?? '').trim().slice(0, 100), page: Math.max(1, Math.min(100_000, Number.parseInt(page ?? '1', 10) || 1)) };
}
