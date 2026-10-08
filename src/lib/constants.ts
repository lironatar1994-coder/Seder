/** Shared vocabulary. Prisma stores these as strings (SQLite has no enums);
 *  Zod validates against these exact tuples at every write. */

export const TASK_STATUSES = ['TODO', 'DONE', 'CANCELED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * *When* a task is due to be worked on — and only that.
 *
 * There is deliberately no INBOX here. Being in the Inbox means the task has no
 * project yet; that is a question of *where*, and mixing the two made giving an
 * unfiled task a date silently move it out of the Inbox.
 */
export const WHEN_BUCKETS = ['SCHEDULED', 'ANYTIME', 'SOMEDAY'] as const;
export type WhenBucket = (typeof WHEN_BUCKETS)[number];

export const PRIORITIES = [1, 2, 3, 4] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: 'דחוף',
  2: 'חשוב',
  3: 'רגיל',
  4: 'ללא עדיפות',
};

export const SWATCHES = ['teal', 'clay', 'plum', 'moss', 'slate', 'rose'] as const;
export type Swatch = (typeof SWATCHES)[number];

export const SWATCH_LABELS: Record<Swatch, string> = {
  teal: 'טורקיז',
  clay: 'חמרה',
  plum: 'שזיף',
  moss: 'אזוב',
  slate: 'צפחה',
  rose: 'ורד',
};

export function swatchVar(color: string): string {
  const safe = (SWATCHES as readonly string[]).includes(color) ? color : 'slate';
  return `var(--swatch-${safe})`;
}

/** The six standing views, in sidebar order. Slugs stay ASCII so URLs are
 *  shareable and typeable; every label the user sees is Hebrew. */
export const VIEWS = [
  { slug: 'inbox', label: 'תיבה נכנסת', hint: 'משימות שעוד לא שויכו לפרויקט' },
  { slug: 'today', label: 'היום', hint: 'מה שקורה היום' },
  { slug: 'upcoming', label: 'בקרוב', hint: 'הימים הבאים' },
  { slug: 'anytime', label: 'בכל עת', hint: 'משימות בפרויקטים, בלי תאריך' },
  { slug: 'someday', label: 'מתישהו', hint: 'רעיונות ומשימות להמשך' },
  { slug: 'logbook', label: 'היסטוריה', hint: 'משימות שהושלמו או בוטלו' },
] as const;

export type ViewSlug = (typeof VIEWS)[number]['slug'];

export const VIEW_SLUGS = VIEWS.map((v) => v.slug) as readonly ViewSlug[];

export function isViewSlug(value: string): value is ViewSlug {
  return (VIEW_SLUGS as readonly string[]).includes(value);
}

export const SESSION_COOKIE = 'seder_session';
/** Sessions last 30 days and renew once they are past halfway. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const SESSION_RENEW_AFTER_MS = SESSION_TTL_MS / 2;

/** Login throttle: after this many consecutive failures the account pauses. */
export const MAX_FAILED_LOGINS = 8;
export const LOGIN_LOCK_MS = 1000 * 60 * 15;
