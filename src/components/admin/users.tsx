'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Search, MessageCircle, CalendarDays } from 'lucide-react';
import { searchAdminUsersAction } from '@/server/admin/actions';
import type { AdminUsersData } from '@/server/admin/users';
import { AdminUserReset } from './controls';
import styles from '@/app/admin/admin.module.css';

const NUMBER = new Intl.NumberFormat('he-IL');
const DATE = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric' });
const FULL_DATE = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function lastActive(date: Date | null, now: Date) {
  if (!date) return 'אין נתון';
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 10) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? 'לפני שעה' : hours === 2 ? 'לפני שעתיים' : `לפני ${hours} שעות`;
  }
  return DATE.format(date);
}

export function AdminUsers({ initial }: { initial: AdminUsersData }) {
  const [data, setData] = useState(initial);
  const [input, setInput] = useState(initial.search);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);
  const draft = useRef(initial.search);
  const dirty = useRef(false);

  const load = useCallback(async (search: string, page = 1, history: 'replace' | 'push' | 'none' = 'replace') => {
    const request = ++sequence.current;
    dirty.current = true;
    setPending(true);
    setError('');
    try {
      const result = await searchAdminUsersAction(search, page);
      // An edit invalidates the preceding response immediately, before its
      // debounce finishes. Only the latest request can publish results or a URL.
      if (request !== sequence.current) return;
      setData(result);
      dirty.current = false;
      if (history !== 'none') {
        const url = new URL(window.location.href);
        if (result.search) url.searchParams.set('q', result.search); else url.searchParams.delete('q');
        if (result.page > 1) url.searchParams.set('page', String(result.page)); else url.searchParams.delete('page');
        if (history === 'push') window.history.pushState(null, '', url);
        else window.history.replaceState(null, '', url);
      }
    } catch {
      if (request === sequence.current) setError('החיפוש לא עודכן. אפשר לנסות שוב');
    } finally {
      if (request === sequence.current) setPending(false);
    }
  }, []);

  useEffect(() => {
    setReady(true);
    function restore() {
      if (timer.current) clearTimeout(timer.current);
      const params = new URL(window.location.href).searchParams;
      const search = params.get('q') ?? '';
      draft.current = search;
      setInput(search);
      void load(search, Number(params.get('page') ?? 1), 'none');
    }
    window.addEventListener('popstate', restore);
    return () => {
      ++sequence.current;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('popstate', restore);
    };
  }, [load]);

  useEffect(() => {
    // A dashboard refresh may finish during an edit; it must not erase it.
    if (dirty.current) return;
    setData(initial);
    draft.current = initial.search;
    setInput(initial.search);
  }, [initial]);

  function edit(text: string) {
    ++sequence.current;
    dirty.current = true;
    draft.current = text;
    setInput(text);
    setPending(true);
    setError('');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void load(text); }, 350);
  }
  const paginationUrl = (page: number) => `?${new URLSearchParams({ ...(data.search ? { q: data.search } : {}), page: String(page) })}`;
  function paginate(event: MouseEvent<HTMLAnchorElement>, page: number) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (timer.current) clearTimeout(timer.current);
    void load(draft.current, page, 'push');
  }

  return (
      <section className={styles.users} aria-labelledby="users-title" aria-busy={pending}>
        <div className={styles.usersHeading}><div className={styles.sectionHeading}><h2 id="users-title">משתמשים</h2><span>{NUMBER.format(data.filteredCount)}</span></div><form className={styles.search} aria-busy={!ready || pending} onSubmit={(event) => { event.preventDefault(); if (timer.current) clearTimeout(timer.current); void load(draft.current); }}>
          <Search size={17} aria-hidden />
          <input aria-label="חיפוש משתמשים לפי שם או אימייל" type="search" dir="auto" value={input} disabled={!ready} onChange={(event) => edit(event.target.value)} placeholder="שם או אימייל" maxLength={100} />
        </form></div>
        {error && <p role="alert" className={styles.serviceWarning}>{error}</p>}
        {data.users.length > 0 ? <table className={styles.table}>
          <thead><tr><th scope="col">משתמש</th><th scope="col" className={styles.activityColumn}>פעילות אחרונה</th><th scope="col">משימות</th><th scope="col">חיבורים</th></tr></thead>
          <tbody>{data.users.map((user) => <tr key={user.id}>
            <td><strong><bdi>{user.name}</bdi></strong><span className={styles.email}><bdi>{user.email}</bdi></span><time className={styles.mobileActivity} dateTime={user.lastActiveAt?.toISOString()}>{lastActive(user.lastActiveAt, data.now)}</time><AdminUserReset userId={user.id} email={user.email} /></td>
            <td className={styles.activityColumn}><time dateTime={user.lastActiveAt?.toISOString()} title={user.lastActiveAt ? FULL_DATE.format(user.lastActiveAt) : undefined}>{lastActive(user.lastActiveAt, data.now)}</time><span className={styles.metadata}>נרשם <bdi>{DATE.format(user.createdAt)}</bdi></span></td>
            <td><span className={styles.taskCounts}><bdi>{NUMBER.format(user.open)}</bdi> פתוחות<span className={styles.completedCount}><bdi>{NUMBER.format(user.completed)}</bdi> הושלמו</span></span><span className={styles.metadata}>{user.projects} פרויקטים</span></td>
            <td><div className={styles.userConnections}>{user.whatsapp && <span title="וואטסאפ פעיל"><MessageCircle size={17} aria-hidden /><span className="sr-only">וואטסאפ פעיל</span></span>}{user.google && <span title={user.googleError ? 'יומן Google: תקלה בסנכרון' : 'יומן Google מחובר'} data-error={user.googleError || undefined}><CalendarDays size={17} aria-hidden /><span className="sr-only">{user.googleError ? 'יומן Google: תקלה בסנכרון' : 'יומן Google מחובר'}</span></span>}{!user.whatsapp && !user.google && <span className={styles.metadata}>ללא</span>}</div></td>
          </tr>)}</tbody>
        </table> : <p className={styles.usersEmpty} role="status">{data.search ? 'לא נמצאו משתמשים לחיפוש הזה' : 'המשתמשים הראשונים יופיעו כאן אחרי ההרשמה'}</p>}
        {data.pages > 1 && <nav className={styles.pagination} aria-label="עמודי משתמשים">{data.page > 1 && <a href={paginationUrl(data.page - 1)} onClick={(event) => paginate(event, data.page - 1)}>הקודם</a>}<span>{data.page} מתוך {data.pages}</span>{data.page < data.pages && <a href={paginationUrl(data.page + 1)} onClick={(event) => paginate(event, data.page + 1)}>הבא</a>}</nav>}
      </section>
  );
}
