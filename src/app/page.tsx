/*
 * DIRECTION CONTRACT — landing (/)
 *
 * THESIS: Todoist's landing structure, told in Hebrew with Seder's own screens.
 *   Sticky header, a hero that pairs one claim with the real interface on a
 *   warm stage, a scroll-driven feature tour where the copy scrolls and the
 *   recording stays, templates, personalisation, questions, one last ask.
 * OWN-WORLD: The app's tokens throughout — paper/surface grounds, the red
 *   action accent, Assistant for everything read, Frank Ruhl Libre only for
 *   the quoted proof lines. Every image and clip is a capture of the running
 *   app with seeded demo data (scripts/landing-media.mjs), never a mock-up.
 * HONESTY: Todoist's press quotes, user counts and ratings have no equivalent
 *   here and are not invented. Their slots carry product facts instead.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { getCurrentUser } from '@/server/auth/session';
import { VIEWS } from '@/lib/constants';
import { PROJECT_TEMPLATES } from '@/lib/project-templates';
import { BrandMark } from '@/components/brand/brand-mark';
import { FeatureScroller, Stage, type FeatureStep } from '@/components/landing/feature-scroller';
import { LoopVideo } from '@/components/landing/loop-video';
import { LANDING_MEDIA } from '@/components/landing/media';
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
  {
    id: 'capture',
    eyebrow: 'לנקות את הראש',
    title: 'לרשום משימה במהירות המחשבה',
    body: (
      <>
        <p>
          כותבים כמו שמדברים: <Q>להתקשר לסבתא היום בשעה 21:30 #בית @טלפון !2</Q>. סדר מזהה תאריך,
          שעה, פרויקט, תווית ועדיפות, מסמן אותם בזמן ההקלדה ושומר כותרת נקייה.
        </p>
      </>
    ),
    clip: 'quick-add',
    clipLabel: 'הקלדת משימה בעברית: התאריך, השעה, הפרויקט והתווית מזוהים ומסומנים לפני השמירה.',
    aspect: 940 / 640,
  },
  {
    id: 'focus',
    eyebrow: 'להתמקד במה שחשוב',
    title: 'היום, בלי רעש',
    body: (
      <p>
        מה שנגרר מאתמול מחכה בקבוצה משלו, ומה שמתוכנן להיום ברשימה נקייה. עיגול אחד מסמן משימה
        כהושלמה, והיא יוצאת מהדרך — עם אפשרות ביטול אם זה היה מוקדם מדי.
      </p>
    ),
    clip: 'complete',
    clipLabel: 'סימון שתי משימות כהושלמו במסך היום.',
    aspect: 940 / 640,
  },
  {
    id: 'plan',
    eyebrow: 'לתכנן בביטחון',
    title: 'לוח שנה שמדבר עברית',
    body: (
      <p>
        כל יום נושא את התאריך הלועזי ואת היום העברי בגימטרייה. שישי ושבת מסומנים כסוף השבוע, מועדי
        הגשה בולטים בנפרד מתזמון, ומעבר בין חודש לשבוע הוא לחיצה אחת.
      </p>
    ),
    clip: 'calendar',
    clipLabel: 'לוח השנה של סדר עם תאריכים עבריים ולועזיים, מעבר מתצוגת חודש לשבוע וחזרה.',
    aspect: 1000 / 736,
  },
  {
    id: 'together',
    eyebrow: 'לעבוד ביחד',
    title: 'פרויקט משותף, לוח אחד',
    body: (
      <p>
        מזמינים חברים בקישור או במייל, מחלקים את העבודה לקטעים וגוררים משימות בין שלבים. אפשר לשייך
        משימה למשתתף ולהגיב עליה, והמשימות האישיות נשארות פרטיות.
      </p>
    ),
    clip: 'board',
    clipLabel: 'גרירת משימה בין קטעים בלוח של פרויקט משותף.',
    aspect: 1320 / 660,
  },
  {
    id: 'jump',
    eyebrow: 'להגיע לכל מקום',
    title: 'חיפוש אחד, וכבר שם',
    body: (
      <p>
        <Key>Ctrl + K</Key> פותח חיפוש אחד למשימות, לפרויקטים ולתצוגות. כמה אותיות ו־Enter, בלי לגעת
        בעכבר. גם <Key>N</Key> למשימה חדשה ו<Key>רווח</Key> לסימון כהושלם.
      </p>
    ),
    clip: 'search',
    clipLabel: 'חיפוש משימה ומעבר ללוח השנה דרך חלון החיפוש.',
    aspect: 1280 / 800,
  },
];

const FAQ = [
  {
    q: 'איך מוסיפים משימה בעברית?',
    a: 'כותבים משפט כמו ״להכין מצגת מחר בשעה 15:30 #עבודה״. סדר מזהה את התאריך, השעה והפרויקט ומציג אותם לפני שמירת המשימה.',
  },
  {
    q: 'אפשר לעבוד על פרויקט ביחד עם חברים?',
    a: 'כן. יוצרים פרויקט, שולחים קישור הזמנה ומנהלים משימות משותפות. אפשר לשייך משימה למשתתף, להוסיף תגובות ולעקוב אחר העבודה בתצוגת רשימה או לוח.',
  },
  {
    q: 'מה ההבדל בין תזמון למועד הגשה?',
    a: 'התזמון קובע מתי מתכננים לעבוד על המשימה. מועד ההגשה קובע עד מתי צריך לסיים אותה. אפשר להגדיר כל אחד מהם בנפרד ולראות את המשימות ביומן עברי ולועזי.',
  },
  {
    q: 'אפשר להשתמש בסדר בטלפון וגם במחשב?',
    a: 'כן. סדר פועל בדפדפן ומתאים למסכים קטנים וגדולים. נכנסים לאותו חשבון כדי לגשת למשימות ולפרויקטים גם מהטלפון וגם מהמחשב.',
  },
  {
    q: 'כמה זה עולה?',
    a: 'פתיחת חשבון ושימוש בסדר הם בחינם, בלי כרטיס אשראי.',
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect('/app/today');

  const templates = PROJECT_TEMPLATES.filter((template) => template.sections.length);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_STRUCTURED_DATA).replace(/</g, '\\u003c') }} />

      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <Container className="flex h-16 items-center gap-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-extrabold text-ink" aria-label="סדר — דף הבית">
            <BrandMark size={30} priority />
            סדר
          </Link>
          <nav aria-label="ניווט בדף" className="hidden items-center gap-1 md:flex">
            <NavLink href="#features">תכונות</NavLink>
            <NavLink href="#templates">תבניות</NavLink>
            <NavLink href="#phone">בטלפון</NavLink>
            <NavLink href="#faq">שאלות נפוצות</NavLink>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-[0.95rem] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              כניסה
            </Link>
            <Cta href="/register" size="sm" />
          </div>
        </Container>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="overflow-hidden">
          <Container className="grid items-center gap-12 pb-16 pt-12 md:pt-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14 lg:pb-24 lg:pt-20">
            <div className="max-lg:text-center">
              {/* The search phrase leads the h1 as a kicker, so the page keeps
                  its indexable heading while the claim does the shouting. */}
              <h1 className="text-5xl font-extrabold leading-[1.05] tracking-normal text-ink md:text-6xl lg:text-[4.25rem]">
                <span className="mb-4 block text-base font-bold leading-normal text-accent md:text-lg">ניהול משימות בעברית</span>
                סוף סוף,
                <br />
                <span className="text-accent">סדר.</span>
              </h1>
              <p className="mt-6 max-w-md text-xl leading-relaxed text-ink-2 max-lg:mx-auto">
                מנהל המשימות שנכתב בעברית מההתחלה. כותבים משפט רגיל, וסדר מבין מה, מתי ואיפה — לבד או
                ביחד, בטלפון ובמחשב.
              </p>
              <div className="mt-8 flex flex-col items-start gap-3 max-lg:items-center">
                <Cta href="/register" size="lg" />
                <p className="text-sm text-muted">חינם, בלי כרטיס אשראי.</p>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-ink-2 max-lg:justify-center">
                {['עברית מימין לשמאל', 'לוח עברי ולועזי', 'פרויקטים משותפים'].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-accent" strokeWidth={3} aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <HeroShot />
          </Container>
        </section>

        {/* ── Proof strip (Todoist's press quotes, as product facts) ───────── */}
        <section aria-label="מה מיוחד בסדר" className="border-y border-line bg-surface-2/60">
          <Container className="grid gap-10 py-12 text-center md:grid-cols-3 md:gap-8 md:py-14">
            <Proof quote="״מחר בשעה 14:30 #עבודה״ — וזו כבר משימה." caption="הוספה מהירה בעברית" />
            <Proof quote="יום עברי ויום לועזי, באותו תא." caption="לוח שנה כפול" />
            <Proof quote="שישי ושבת הם סוף השבוע." caption="שבוע ישראלי, מימין לשמאל" />
          </Container>
        </section>

        {/* ── Feature tour ─────────────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-16">
          <Container className="py-20 lg:py-24">
            <SectionHead
              eyebrow="איך זה עובד"
              title="כל מה שצריך, ושום דבר שמפריע"
              body="חמש דקות עם סדר, בלי מצגת ובלי הדרכה. אלה הקלטות של הממשק עצמו, עם משימות לדוגמה."
            />
            <div className="mt-14 lg:mt-4">
              <FeatureScroller steps={STEPS} />
            </div>
          </Container>
        </section>

        {/* ── Phone + WhatsApp ─────────────────────────────────────────────── */}
        <section id="phone" className="scroll-mt-16 bg-surface-sunk">
          <Container className="grid items-center gap-14 py-20 lg:grid-cols-2 lg:py-28">
            <div>
              <p className="text-sm font-bold text-accent">בכיס</p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">סדר גם בטלפון</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-2">
                אותו חשבון, ישר מהדפדפן: לשוניות למטה, כפתור הוספה בהישג האגודל, וזיהוי של עברית בדיוק
                כמו במחשב.
              </p>
              <div className="mt-10 flex max-w-md items-start gap-4 rounded-2xl border border-line bg-paper p-4 shadow-row">
                <Image
                  src="/seder/images/whatsapp-reminder-preview.webp"
                  alt="דוגמה לתזכורת מסדר בוואטסאפ: תזכורת להכין את המצגת, שמתחילה בשעה 15:30."
                  width={160}
                  height={120}
                  className="w-32 shrink-0 rounded-lg"
                />
                <div>
                  <h3 className="font-bold">ותזכורת בוואטסאפ, אם רוצים</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">
                    מפעילים בהגדרות, וסדר שולח הודעה לפני שמשימה מתחילה.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Phone>
                <LoopVideo name="phone" label="הוספת משימה בטלפון: הקלדה בעברית, זיהוי השעה והעדיפות, והמשימה מופיעה במסך היום." />
              </Phone>
            </div>
          </Container>
        </section>

        {/* ── Templates ────────────────────────────────────────────────────── */}
        <section id="templates" className="scroll-mt-16">
          <Container className="py-20 lg:py-28">
            <SectionHead
              center
              eyebrow="תבניות"
              title="מתחילים פרויקט מתבנית"
              body="בלי לבנות מאפס: כל תבנית מגיעה עם קטעים מוכנים בלוח, ואפשר לשנות בה הכול."
            />
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {templates.map((template) => (
                <li key={template.id} className="group flex flex-col rounded-2xl border border-line bg-paper p-5 transition-shadow duration-200 hover:shadow-pop">
                  <div className="landing-stage flex gap-2 overflow-hidden rounded-xl p-3" aria-hidden>
                    {template.sections.map((section) => (
                      <div key={section} className="min-w-0 flex-1 rounded-lg bg-paper/90 p-2 shadow-row">
                        <p className="truncate text-[0.7rem] font-bold text-ink-2">{section}</p>
                        <div className="mt-2 space-y-1.5">
                          <span className="block h-1.5 w-full rounded-full bg-line" />
                          <span className="block h-1.5 w-2/3 rounded-full bg-line" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{template.name}</h3>
                  <p className="mt-1 text-sm text-muted">{template.sections.join(' · ')}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-center">
              <Link href="/register" className="inline-flex items-center gap-1.5 font-semibold text-accent underline-offset-4 hover:underline">
                לפתוח חשבון ולנסות תבנית
                <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </p>
          </Container>
        </section>

        {/* ── Make it yours ────────────────────────────────────────────────── */}
        <section className="border-t border-line">
          <Container className="grid items-center gap-14 py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:py-28">
            <div>
              <p className="text-sm font-bold text-accent">בדיוק כמו שנוח</p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">בהיר, כהה ושמונה צבעים</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-2">
                בוחרים בהירות וצבע ראשי, והממשק מתעדכן מיד. גם גודל הטקסט במחשב ניתן לשינוי — קומפקטי,
                רגיל או גדול.
              </p>
            </div>
            <Stage>
              <div className="overflow-hidden rounded-xl bg-paper shadow-pop ring-1 ring-line" style={{ aspectRatio: 1280 / 800 }}>
                <LoopVideo name="theme" label="מסך ההגדרות: החלפת הצבע הראשי ומעבר למצב כהה." />
              </div>
            </Stage>
          </Container>
        </section>

        {/* ── Views (Todoist's "for life" block, as the fixed structure) ────── */}
        <section className="bg-surface-sunk">
          <Container className="py-20 lg:py-24">
            <SectionHead
              eyebrow="מבנה קבוע"
              title="שש תצוגות קבועות, ואפס הגדרות לפני שמתחילים"
              body="כל משימה יודעת איפה היא — בפרויקט או בתיבה הנכנסת — ומתי — בתאריך, בכל עת או מתישהו."
            />
            <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VIEWS.map((view) => (
                <div key={view.slug} className="rounded-2xl bg-paper p-5 shadow-row">
                  <dt className="text-lg font-bold">{view.label}</dt>
                  <dd className="mt-1 text-ink-2">{view.hint}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-16" aria-labelledby="faq-title">
          <Container className="grid gap-10 py-20 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:py-28">
            <h2 id="faq-title" className="text-4xl font-extrabold leading-tight">שאלות על ניהול משימות בסדר</h2>
            <div className="divide-y divide-line border-y border-line">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xl leading-none text-ink-2 transition-transform duration-200 group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">{item.a}</p>
                </details>
              ))}
            </div>
          </Container>
        </section>

        {/* ── Last ask ─────────────────────────────────────────────────────── */}
        <section className="landing-stage">
          <Container className="py-20 text-center lg:py-28">
            <h2 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">
              המשימה הראשונה היא פשוט להתחיל לכתוב.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-lg text-ink-2">חשבון חינם, עברית אמיתית, ושום דבר להתקין.</p>
            <div className="mt-8 flex justify-center">
              <Cta href="/register" size="lg" />
            </div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-line">
        <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 text-xl font-extrabold">
              <BrandMark size={26} />
              סדר
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">ניהול משימות ופרויקטים משותפים, בעברית מההתחלה.</p>
          </div>
          <FooterColumn title="מוצר" links={[['#features', 'תכונות'], ['#templates', 'תבניות'], ['#phone', 'בטלפון'], ['#faq', 'שאלות נפוצות']]} />
          <FooterColumn title="תצוגות" links={VIEWS.slice(0, 4).map((view) => ['/register', view.label] as [string, string])} />
          <FooterColumn title="חשבון" links={[['/register', 'פתיחת חשבון'], ['/login', 'כניסה'], ['/privacy', 'פרטיות']]} />
        </Container>
        <Container className="border-t border-line py-6 text-sm text-muted">סדר · נכתב בישראל, מימין לשמאל.</Container>
      </footer>
    </div>
  );
}

/** Todoist's hero picture: desktop app with the phone layered over its edge. */
function HeroShot() {
  const desktopAlt = 'מסך היום בסדר במחשב, עם משימות לדוגמה: משימה באיחור, משימות להיום, פרויקטים ותוויות.';
  const phoneAlt = 'מסך היום בסדר בטלפון, עם לשוניות ניווט וכפתור הוספה.';
  return (
    <div className="relative">
      {/* Cropped to the rail and the task list, at a size where the rows can
          be read — the whole 1440px window scaled into this column is not. */}
      <Stage className="pb-0 pe-0">
        <div className="relative aspect-[1.3] overflow-hidden rounded-ss-xl border-s border-t border-line bg-paper shadow-pop">
          {(['light', 'dark'] as const).map((theme) => (
            <Image
              key={theme}
              data-shot={theme}
              src={`${LANDING_MEDIA}/hero-desktop-${theme}.png`}
              alt={desktopAlt}
              width={2880}
              height={1800}
              priority
              sizes="(min-width: 1024px) 1050px, 150vw"
              className="absolute start-0 top-0 h-auto w-[148%] max-w-none"
            />
          ))}
        </div>
      </Stage>
      <div className="absolute -bottom-6 end-[-0.5rem] w-[27%] min-w-28 max-w-52 sm:end-4">
        <div className="overflow-hidden rounded-[1.6rem] border-[5px] border-ink bg-paper shadow-pop">
          {(['light', 'dark'] as const).map((theme) => (
            <Image
              key={theme}
              data-shot={theme}
              src={`${LANDING_MEDIA}/hero-phone-${theme}.png`}
              alt={phoneAlt}
              width={1170}
              height={2532}
              priority
              sizes="210px"
              className="h-auto w-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[18rem] rounded-[2.6rem] border-[9px] border-ink bg-ink shadow-pop sm:w-[19.5rem]">
      <div className="absolute inset-x-0 top-2 z-10 mx-auto h-5 w-24 rounded-full bg-ink" aria-hidden />
      <div className="overflow-hidden rounded-[2rem] bg-paper" style={{ aspectRatio: 390 / 844 }}>
        {children}
      </div>
    </div>
  );
}

function Proof({ quote, caption }: { quote: string; caption: string }) {
  return (
    <figure>
      <blockquote className="display text-2xl leading-snug text-ink">{quote}</blockquote>
      <figcaption className="mt-3 text-sm font-bold text-muted">{caption}</figcaption>
    </figure>
  );
}

function SectionHead({ eyebrow, title, body, center = false }: { eyebrow: string; title: string; body: string; center?: boolean }) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-sm font-bold text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">{title}</h2>
      <p className="mt-5 text-lg leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="rounded-lg px-3 py-2 text-[0.95rem] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
      {children}
    </a>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {links.map(([href, label]) => (
          <li key={label}>
            <Link href={href} className="underline-offset-4 hover:text-ink hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cta({ href, size }: { href: string; size: 'sm' | 'lg' }) {
  return (
    <Link
      href={href}
      className={
        size === 'lg'
          ? 'inline-flex h-14 select-none items-center gap-2 rounded-xl bg-accent px-8 text-lg font-bold text-[var(--on-accent)] shadow-pop transition-colors duration-120 hover:bg-accent-hover'
          : 'inline-flex h-10 select-none items-center rounded-lg bg-accent px-4 text-[0.95rem] font-bold text-[var(--on-accent)] transition-colors duration-120 hover:bg-accent-hover'
      }
    >
      להתחיל בחינם
      {/* Forward points left in Hebrew; the icon is already drawn that way. */}
      {size === 'lg' && <ArrowLeft className="size-5" aria-hidden />}
    </Link>
  );
}

/** A quoted quick-add sentence: an LTR-safe island that keeps # and @ in place. */
function Q({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-semibold text-ink [unicode-bidi:isolate]">{children}</span>;
}

/** A key cap. Latin keys are LTR islands inside the Hebrew sentence. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      dir="auto"
      className="mx-0.5 inline-block rounded-md border border-line-strong bg-surface px-1.5 py-0.5 font-sans text-sm font-semibold text-ink-2 [unicode-bidi:isolate]"
    >
      {children}
    </kbd>
  );
}
