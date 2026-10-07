import { ChevronDown, LogOut, Mail, MessageCircle, CalendarDays } from 'lucide-react';
import { getAdminOverview } from '@/server/admin/overview';
import { logoutAction } from '@/server/auth/actions';
import { ThemeToggle } from '@/components/nav/theme-toggle';
import { AdminRefresh, AdminPassword, AdminPairing } from '@/components/admin/controls';
import styles from './admin.module.css';
import { AdminUsers } from '@/components/admin/users';

export const dynamic = 'force-dynamic';

const NUMBER = new Intl.NumberFormat('he-IL');
const TIME = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
const DATE = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric' });

const WA: Record<string, string> = {
  READY: 'מחובר', NEEDS_SCAN: 'ממתין לסריקה', INITIALIZING: 'מתחבר', DISCONNECTED: 'מנסה להתחבר',
  LOGGED_OUT: 'נדרש חיבור מחדש', ERROR: 'תקלה בחיבור', OFFLINE: 'לא פועל',
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const data = await getAdminOverview(await searchParams);
  const wa = data.services.whatsapp;
  const google = data.services.google;
  const chartMax = Math.max(1, ...data.days.flatMap((day) => [day.created, day.completed]));
  const chartCreated = data.days.reduce((sum, day) => sum + day.created, 0);
  const chartCompleted = data.days.reduce((sum, day) => sum + day.completed, 0);

  return <div className={styles.shell} data-admin-shell>
    <header className={styles.header}>
      <div className={styles.brand}><span>סדר</span><span className={styles.divider} aria-hidden /><h1>ניהול</h1></div>
      <div className={styles.headerActions}>
        <time className={styles.updated} dateTime={data.now.toISOString()}>עודכן <bdi>{TIME.format(data.now)}</bdi></time>
        <AdminRefresh />
        <ThemeToggle />
        <form action={logoutAction}><button className={styles.logout} type="submit" aria-label="יציאה" title="יציאה"><LogOut size={17} aria-hidden /><span>יציאה</span></button></form>
      </div>
    </header>

    <main className={styles.main}>
      <dl className={styles.metrics} aria-label="תמונת מצב">
        <div><dt>משתמשים</dt><dd>{NUMBER.format(data.totals.users)}</dd><span>{NUMBER.format(data.totals.newUsers)} חדשים השבוע</span></div>
        <div><dt>פעילים השבוע</dt><dd>{NUMBER.format(data.totals.active)}</dd><span>השתמשו ב־7 הימים האחרונים</span></div>
        <div><dt>משימות שנוצרו</dt><dd>{NUMBER.format(data.totals.created)}</dd><span>ב־7 הימים האחרונים</span></div>
        <div><dt>משימות שהושלמו</dt><dd>{NUMBER.format(data.totals.completed)}</dd><span>ב־7 הימים האחרונים</span></div>
      </dl>

      <div className={styles.overview}>
        <section className={styles.activity} aria-labelledby="activity-title">
          <div className={styles.sectionHeading}><h2 id="activity-title">משימות</h2><span>14 ימים</span><span className={styles.openCount}>{NUMBER.format(data.totals.open)} פתוחות כרגע</span></div>
          <div className={styles.legend}><span><i className={styles.createdKey} aria-hidden />נוצרו <bdi>{NUMBER.format(chartCreated)}</bdi></span><span><i className={styles.completedKey} aria-hidden />הושלמו <bdi>{NUMBER.format(chartCompleted)}</bdi></span></div>
          {chartCreated + chartCompleted > 0 ? <figure className={styles.chart} aria-label="משימות שנוצרו והושלמו בכל יום">
            <div className={styles.chartScale} aria-hidden><span>{NUMBER.format(chartMax)}</span><span>{NUMBER.format(Math.floor(chartMax / 2))}</span><span>0</span></div>
            <div className={styles.plot}>
              <div className={styles.gridLines} aria-hidden><span /><span /><span /></div>
              {data.days.map((day, index) => <div className={styles.day} key={day.key} tabIndex={0} role="img" aria-label={`${DATE.format(day.date)}: ${day.created} נוצרו, ${day.completed} הושלמו`}>
                <div className={styles.barPair} aria-hidden>
                  <span className={styles.createdBar} style={{ height: `${day.created / chartMax * 100}%` }} />
                  <span className={styles.completedBar} style={{ height: `${day.completed / chartMax * 100}%` }} />
                </div>
                <span className={styles.dayLabel} aria-hidden>{index === 13 ? 'היום' : index === 0 || index === 6 ? DATE.format(day.date) : ''}</span>
                <span className={styles.chartTooltip} aria-hidden><strong>{DATE.format(day.date)}</strong><span>{day.created} נוצרו · {day.completed} הושלמו</span></span>
              </div>)}
            </div>
          </figure> : <div className={styles.chartEmpty}>אין פעילות ב־14 הימים האחרונים</div>}
        </section>

        <section className={styles.services} aria-labelledby="services-title">
          <h2 id="services-title">חיבורים</h2>
          <div className={styles.service}>
            <MessageCircle size={19} aria-hidden /><div><strong>וואטסאפ</strong><span>{wa.enabled} משתמשים · {wa.sent} נשלחו ב־24 שעות</span></div>
            <span className={styles.state} data-tone={wa.stale || !['READY', 'INITIALIZING'].includes(wa.status) ? 'warn' : wa.status === 'READY' ? 'ok' : 'neutral'}><i aria-hidden />{wa.stale ? 'לא מגיב' : WA[wa.status] ?? 'לא ידוע'}</span>
          </div>
          {wa.failed > 0 && <p className={styles.serviceWarning} role="status">{wa.failed} הודעות נכשלו ב־24 השעות האחרונות</p>}
          <AdminPairing status={wa.status} stale={wa.stale} qr={wa.qr} />
          <div className={styles.service}>
            <CalendarDays size={19} aria-hidden /><div><strong>יומן Google</strong><span>{google.connected} משתמשים מחוברים</span></div>
            <span className={styles.state} data-tone={google.errors > 0 ? 'warn' : google.configured ? 'ok' : 'neutral'}><i aria-hidden />{google.errors ? `${google.errors} תקלות סנכרון` : google.configured ? 'מוגדר' : 'לא הוגדר'}</span>
          </div>
          <div className={styles.service}>
            <Mail size={19} aria-hidden /><div><strong>מייל</strong><span>איפוס סיסמה והזמנות</span></div>
            <span className={styles.state} data-tone={data.services.mail.configured ? 'ok' : 'warn'}><i aria-hidden />{data.services.mail.configured ? 'מוגדר' : 'לא הוגדר'}</span>
          </div>
        </section>
      </div>

      <AdminUsers initial={{ now: data.now, search: data.search, page: data.page, pages: data.pages, filteredCount: data.filteredCount, users: data.users }} />

      <footer className={styles.footer}><bdi>{data.admin.email}</bdi><details className={styles.password}><summary>סיסמה <ChevronDown size={15} aria-hidden /></summary><AdminPassword /></details></footer>
    </main>
  </div>;
}
