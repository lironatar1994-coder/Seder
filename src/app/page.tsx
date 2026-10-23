/*
 * DIRECTION CONTRACT — landing (/)
 *
 * THESIS: Todoist's landing structure, in Hebrew, carried by animation rather
 *   than prose. Every section is one short headline, one line, and a scene.
 * SCENES: Drawn, zoomed-in slices of the interface built from the app's own
 *   tokens (components/landing/scenes.tsx) — not screen recordings, which at
 *   landing-page size are a blur of small text nobody can follow.
 * PHONE FIRST: Scenes scale with container units, so a 360px phone sees the
 *   same composition as a desktop column. Copy is one line per section; the
 *   call to action follows the thumb.
 * HONESTY: No invented users, ratings or press. The demo data is labelled as
 *   such for assistive technology.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { getCurrentUser } from '@/server/auth/session';
import { PROJECT_TEMPLATES } from '@/lib/project-templates';
import { BrandMark } from '@/components/brand/brand-mark';
import { FeatureScroller, type FeatureStep } from '@/components/landing/feature-scroller';
import { CaptureScene, PhoneScene, ThemeScene } from '@/components/landing/scenes';
import { MobileCta } from '@/components/landing/mobile-cta';
import { PUBLIC_SITE_URL, SITE_TITLE, SITE_DESCRIPTION, SITE_IMAGE, SITE_STRUCTURED_DATA } from '@/lib/seo';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: PUBLIC_SITE_URL },
  robots: { index: true, follow: true },
  verification: { google: 'SOnMsCKErKrO0Aghp9B9YI_j7h5hhLsX6_4m4l_MtTY' },
  openGraph: { type: 'website', locale: 'he_IL', siteName: 'סדר — Seder', title: SITE_TITLE, description: SITE_DESCRIPTION, url: PUBLIC_SITE_URL, images: [{ url: SITE_IMAGE, width: 1254, height: 1254, alt: 'סדר — ניהול משימות בעברית' }] },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SITE_IMAGE] },
};

const STEPS: FeatureStep[] = [
  { id: 'focus', eyebrow: 'להתמקד', title: 'רק מה שחשוב היום', line: 'עיגול אחד, והמשימה יוצאת מהדרך.', scene: 'focus' },
  { id: 'plan', eyebrow: 'לתכנן', title: 'לוח עברי ולועזי', line: 'שני התאריכים בכל יום. גוררים — וזה זז.', scene: 'calendar' },
  { id: 'together', eyebrow: 'ביחד', title: 'פרויקטים משותפים', line: 'מזמינים בקישור, מחלקים ומגיבים.', scene: 'together' },
];

const FAQ = [
  { q: 'איך מוסיפים משימה בעברית?', a: 'כותבים משפט כמו ״להכין מצגת מחר בשעה 15:30 #עבודה״. סדר מזהה את התאריך, השעה והפרויקט ומציג אותם לפני שמירת המשימה.' },
  { q: 'אפשר לעבוד על פרויקט ביחד עם חברים?', a: 'כן. יוצרים פרויקט, שולחים קישור הזמנה ומנהלים משימות משותפות. אפשר לשייך משימה למשתתף, להוסיף תגובות ולעקוב אחר העבודה בתצוגת רשימה או לוח.' },
  { q: 'מה ההבדל בין תזמון למועד הגשה?', a: 'התזמון קובע מתי מתכננים לעבוד על המשימה. מועד ההגשה קובע עד מתי צריך לסיים אותה. אפשר להגדיר כל אחד מהם בנפרד ולראות את המשימות ביומן עברי ולועזי.' },
  { q: 'אפשר להשתמש בסדר בטלפון וגם במחשב?', a: 'כן. סדר פועל בדפדפן ומתאים למסכים קטנים וגדולים. נכנסים לאותו חשבון מהטלפון ומהמחשב.' },
  { q: 'כמה זה עולה?', a: 'פתיחת חשבון ושימוש בסדר הם בחינם, בלי כרטיס אשראי.' },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect('/app/today');

  const templates = PROJECT_TEMPLATES.filter((template) => template.sections.length);

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_STRUCTURED_DATA).replace(/</g, '\\u003c') }} />

      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <Container className="flex h-14 items-center gap-8 md:h-16">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-extrabold text-ink" aria-label="סדר — דף הבית">
            <BrandMark size={28} priority />
            סדר
          </Link>
          <nav aria-label="ניווט בדף" className="hidden items-center gap-1 md:flex">
            <NavLink href="#features">תכונות</NavLink>
            <NavLink href="#phone">בטלפון</NavLink>
            <NavLink href="#templates">תבניות</NavLink>
            <NavLink href="#faq">שאלות</NavLink>
          </nav>
          <div className="ms-auto flex items-center gap-1 md:gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              כניסה
            </Link>
            <Link href="/register" className="hidden h-10 items-center rounded-lg bg-accent px-4 font-bold text-[var(--on-accent)] transition-colors hover:bg-accent-hover sm:inline-flex">
              להתחיל בחינם
            </Link>
          </div>
        </Container>
      </header>

      <main>
        {/* ── Hero ── */}
        <section>
          <Container className="grid items-center gap-10 pb-16 pt-10 md:pt-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:pb-24 lg:pt-20">
            <div className="text-center lg:text-start">
              <h1 className="text-[3.25rem] font-extrabold leading-[1.02] text-ink sm:text-6xl lg:text-7xl">
                <span className="mb-4 block text-base font-bold leading-normal text-accent md:text-lg">ניהול משימות בעברית</span>
                סוף סוף,
                <br />
                <span className="text-accent">סדר.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-sm text-xl text-ink-2 lg:mx-0 lg:text-2xl">כותבים משפט. מקבלים משימה.</p>
              <div data-hero-cta className="mt-8 flex flex-col items-center gap-3 lg:items-start">
                <Cta />
                <p className="text-sm text-muted">חינם. בלי כרטיס אשראי.</p>
              </div>
            </div>
            <CaptureScene />
          </Container>
        </section>

        {/* ── Three facts, Todoist's quote row ── */}
        <section aria-label="מה מיוחד בסדר" className="border-y border-line bg-surface-2/60">
          <Container className="flex flex-wrap justify-center gap-x-10 gap-y-3 py-6 md:py-8">
            {['עברית מימין לשמאל', 'תאריך עברי בכל יום', 'שישי־שבת סוף שבוע'].map((fact) => (
              <span key={fact} className="inline-flex items-center gap-2 font-bold text-ink-2 md:text-lg">
                <Check className="size-5 text-accent" strokeWidth={3} aria-hidden />
                {fact}
              </span>
            ))}
          </Container>
        </section>

        {/* ── Feature tour ── */}
        <section id="features" className="scroll-mt-16">
          <Container className="py-16 lg:py-12">
            <FeatureScroller steps={STEPS} />
          </Container>
        </section>

        {/* ── Phone + WhatsApp ── */}
        <section id="phone" className="scroll-mt-16 bg-surface-sunk">
          <Container className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
            <div className="text-center lg:text-start">
              <p className="text-sm font-bold text-accent">בטלפון</p>
              <h2 className="mt-2 text-[2.5rem] font-extrabold leading-[1.1] md:text-6xl">סדר בכיס</h2>
              <p className="mt-3 text-lg text-ink-2 lg:text-xl">ותזכורת בוואטסאפ, אם רוצים.</p>
            </div>
            <PhoneScene />
          </Container>
        </section>

        {/* ── Templates ── */}
        <section id="templates" className="scroll-mt-16">
          <Container className="py-16 lg:py-24">
            <div className="text-center">
              <p className="text-sm font-bold text-accent">תבניות</p>
              <h2 className="mt-2 text-[2.5rem] font-extrabold leading-[1.1] md:text-6xl">מתחילים מתבנית</h2>
            </div>
            {/* A swipeable row on a phone, a grid from tablet up. */}
            <ul className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {templates.map((template) => (
                <li key={template.id} className="w-[78%] shrink-0 snap-center sm:w-auto">
                  <Link href="/register" className="block rounded-2xl border border-line bg-paper p-4 transition-shadow duration-200 hover:shadow-pop">
                    <div className="landing-stage flex gap-2 rounded-xl p-3" aria-hidden>
                      {template.sections.map((section, i) => (
                        <div key={section} className="min-w-0 flex-1 rounded-lg bg-paper/90 p-2 shadow-row">
                          <p className="truncate text-[0.7rem] font-bold text-ink-2">{section}</p>
                          <div className="mt-2 space-y-1.5">
                            {Array.from({ length: 3 - (i % 2) }, (_, k) => (
                              <span key={k} className="block h-2 rounded-full bg-line" style={{ width: `${90 - k * 25}%` }} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-lg font-bold">{template.name}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* ── Appearance ── */}
        <section className="border-t border-line">
          <Container className="grid items-center gap-10 py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-24">
            <div className="text-center lg:text-start">
              <p className="text-sm font-bold text-accent">בדיוק כמו שנוח</p>
              <h2 className="mt-2 text-[2.5rem] font-extrabold leading-[1.1] md:text-6xl">בצבעים שלכם</h2>
              <p className="mt-3 text-lg text-ink-2 lg:text-xl">שמונה צבעים, בהיר או כהה.</p>
            </div>
            <ThemeScene />
          </Container>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="scroll-mt-16 bg-surface-sunk" aria-labelledby="faq-title">
          <Container className="max-w-3xl py-16 lg:py-24">
            <h2 id="faq-title" className="text-center text-3xl font-extrabold md:text-4xl">שאלות על ניהול משימות בסדר</h2>
            <div className="mt-8 divide-y divide-line rounded-2xl bg-paper px-5 shadow-row">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xl leading-none text-ink-2 transition-transform duration-200 group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-2 leading-relaxed text-ink-2">{item.a}</p>
                </details>
              ))}
            </div>
          </Container>
        </section>

        {/* ── Last ask ── */}
        <section className="landing-stage">
          <Container className="py-20 text-center lg:py-28">
            <h2 className="text-[2.5rem] font-extrabold leading-[1.1] md:text-6xl">המשימה הראשונה מחכה.</h2>
            <div data-closing-cta className="mt-8 flex justify-center">
              <Cta />
            </div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-line pb-24 md:pb-0">
        <Container className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-8 text-sm text-muted">
          <span className="inline-flex items-center gap-2 text-lg font-extrabold text-ink">
            <BrandMark size={24} />
            סדר
          </span>
          <nav aria-label="קישורים" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/register" className="hover:text-ink">פתיחת חשבון</Link>
            <Link href="/login" className="hover:text-ink">כניסה</Link>
            <Link href="/privacy" className="hover:text-ink">פרטיות</Link>
          </nav>
        </Container>
      </footer>

      <MobileCta />
    </div>
  );
}

function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="rounded-lg px-3 py-2 font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
      {children}
    </a>
  );
}

function Cta() {
  return (
    <Link
      href="/register"
      className="inline-flex h-14 w-full max-w-xs select-none items-center justify-center gap-2 rounded-xl bg-accent px-8 text-lg font-bold text-[var(--on-accent)] shadow-pop transition-colors duration-120 hover:bg-accent-hover sm:w-auto"
    >
      להתחיל בחינם
      {/* Forward points left in Hebrew; the icon is already drawn that way. */}
      <ArrowLeft className="size-5" aria-hidden />
    </Link>
  );
}
