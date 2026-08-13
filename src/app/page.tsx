/*
 * DIRECTION CONTRACT — landing (/)
 *
 * THESIS: One Hebrew sentence visibly becoming a task. The page argues by
 *   performing the parse, and refuses the category default: a hero claim over a
 *   three-up grid of icon-heading-text feature cards.
 * OWN-WORLD: The app's own system, inherited whole — paper/surface tokens,
 *   Frank Ruhl Libre for display, Assistant for interface, Inter for numerals
 *   only; indigo accent, amber strictly for time pressure, hairlines instead of
 *   cards, one shadow tier.
 * STORY: An Israeli sees Hebrew read correctly, understands this was written in
 *   Hebrew rather than translated into it, and opens a free account.
 * FIRST VIEWPORT: Wordmark and כניסה on one hairline row. Two display lines at
 *   the inline-start, one line of prose under them, then the composer demo at
 *   full measure — typing, parsing, stripping, saving. The primary action sits
 *   directly beneath it.
 * FORM: Candidate 3 of the grounded list ("the sentence that becomes a task");
 *   seed key seder01.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 *   finish review, the verdict, and DESIGN.md.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/server/auth/session';
import { VIEWS } from '@/lib/constants';
import { ParseDemo } from '@/components/landing/parse-demo';
import { MonthPreview } from '@/components/landing/month-preview';
import { BrandMark } from '@/components/brand/brand-mark';

export const metadata: Metadata = {
  title: 'סדר — מנהל משימות בעברית',
  description:
    'מנהל משימות שנכתב בעברית מההתחלה. כותבים משפט רגיל והוא נשמר כמשימה מתוזמנת, עם לוח שנה עברי ולועזי ותאריך הגשה בנפרד מהתזמון.',
};

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect('/app/today');

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="display inline-flex items-center gap-2 text-xl font-bold text-ink">
            <BrandMark size={28} priority />
            סדר
          </span>
          <Link
            href="/login"
            className="text-sm font-semibold text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            כניסה
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* The hero does not describe the product; it runs it. The demo takes
            the inline-end column so the claim and its proof are one glance
            apart, and the action sits under the claim rather than below the
            fold. */}
        <section className="grid items-center gap-10 pb-16 pt-12 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:gap-12 md:pb-28 md:pt-24">
          <div>
            <h1 className="display text-4xl font-bold leading-[1.15] text-ink md:text-5xl">
              כותבים בעברית.
              <br />
              מקבלים סדר.
            </h1>
            {/* Two even lines rather than a widow: at this measure the default
                break drops "אליה." alone onto the second line. */}
            <p className="mt-5 max-w-sm text-lg leading-relaxed text-balance text-ink-2">
              מנהל משימות שנכתב בעברית מההתחלה — לא תורגם אליה.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex h-12 select-none items-center gap-2 rounded-lg bg-accent px-6 font-semibold text-[var(--on-accent)] shadow-row transition-colors duration-120 hover:bg-accent-hover"
              >
                לפתוח חשבון
                {/* "Forward" points left in Hebrew. */}
                <ArrowLeft className="size-4 icon-flip" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 select-none items-center rounded-lg border border-line-strong bg-surface px-6 font-semibold text-ink transition-colors duration-120 hover:bg-surface-2"
              >
                כבר יש לי חשבון
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted">חינם, בלי כרטיס אשראי.</p>
          </div>

          <ParseDemo />
        </section>

        <section className="border-t border-line py-16 md:py-24">
          <div className="grid gap-8 md:grid-cols-2 md:gap-14">
            <div>
              <h2 className="display text-2xl font-bold leading-snug text-ink md:text-3xl">
                שני תאריכים, לא אחד
              </h2>
              <p className="mt-3 leading-relaxed text-ink-2">
                מתי עובדים על זה ומתי זה חייב להיות מוכן הם לא אותו דבר, ולכן הם לא אותו שדה. משימה
                שמתוזמנת ליום שני עם הגשה ביום רביעי מופיעה בלוח פעמיים. זו לא כפילות, זו התמונה
                המלאה.
              </p>
            </div>

            <div>
              <h2 className="display text-2xl font-bold leading-snug text-ink md:text-3xl">
                כל יום נושא את שני הלוחות
              </h2>
              <p className="mt-3 leading-relaxed text-ink-2">
                התאריך הלועזי בספרות, ולצידו היום העברי בגימטרייה. שם החודש העברי מופיע פעם אחת,
                בראש חודש, במקום לחזור בשלושים תאים. שישי ושבת הם סוף השבוע, כי כאן זה סוף השבוע.
              </p>
            </div>
          </div>

          <div className="mt-10 md:mt-14">
            <MonthPreview />
          </div>
        </section>

        <section className="border-t border-line py-16 md:py-24">
          <h2 className="display max-w-lg text-2xl font-bold leading-snug text-ink md:text-3xl">
            שש תצוגות קבועות, ואפס הגדרות לפני שמתחילים
          </h2>

          <dl className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {VIEWS.map((view) => (
              <div key={view.slug} className="flex items-baseline gap-3 border-t border-line pt-3">
                <dt className="shrink-0 font-semibold text-ink">{view.label}</dt>
                <dd className="text-sm text-muted">{view.hint}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 max-w-2xl leading-relaxed text-ink-2">
            הכול מגיע גם מהמקלדת: <Key>Ctrl + K</Key> לחיפוש ולקפיצה לכל מקום, <Key>N</Key> למשימה
            חדשה, <Key>רווח</Key> לסימון כהושלם. החצים מזיזים תאריך — ושמאלה זה קדימה, כמו שקוראים.
          </p>
        </section>

        <section className="border-t border-line py-16 md:py-20">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-6">
            <p className="display max-w-md text-2xl font-bold leading-snug text-ink md:text-3xl">
              המשימה הראשונה היא פשוט להתחיל לכתוב.
            </p>
            <Link
              href="/register"
              className="inline-flex h-12 shrink-0 select-none items-center gap-2 rounded-lg bg-accent px-6 font-semibold text-[var(--on-accent)] shadow-row transition-colors duration-120 hover:bg-accent-hover"
            >
              לפתוח חשבון
              <ArrowLeft className="size-4 icon-flip" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted">
          <span className="display inline-flex items-center gap-2 font-bold text-ink-2">
            <BrandMark size={24} />
            סדר
          </span>
          <Link
            href="/login"
            className="underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            כניסה לחשבון קיים
          </Link>
        </div>
      </footer>
    </div>
  );
}

/** A key cap. Latin keys are LTR islands inside the Hebrew sentence. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      dir="auto"
      className="mx-0.5 inline-block rounded-sm border border-line-strong bg-surface px-1.5 py-0.5 font-sans text-xs font-semibold text-ink-2 [unicode-bidi:isolate]"
    >
      {children}
    </kbd>
  );
}
