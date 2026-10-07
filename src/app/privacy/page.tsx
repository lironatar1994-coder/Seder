import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/brand-mark';

export const metadata: Metadata = {
  title: 'פרטיות · סדר',
  description: 'איך סדר משתמשת במידע שלכם ובחיבור ליומן Google.',
  alternates: { canonical: 'https://lawebs.co.il/seder/privacy' },
};

export default function PrivacyPage() {
  return <div className="min-h-dvh bg-paper text-ink">
    <header className="border-be border-line">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold"><BrandMark size={28} />סדר</Link>
        <Link href="/app/settings/calendar" className="min-h-11 py-2 text-sm font-semibold text-ink-2 hover:underline">הגדרות היומן</Link>
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-8 px-6 pb-16 pt-10 text-base leading-relaxed">
      <h1 className="text-3xl font-bold">הפרטיות שלכם בסדר</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">מידע בחשבון</h2>
        <p>סדר שומרת את פרטי החשבון, המשימות, הפרויקטים וההעדפות שהזנתם כדי להפעיל את השירות. משימות בפרויקטים משותפים מוצגות לחברי הפרויקט. פרטי שימוש טכניים מסייעים להפעלת השירות ולתפעולו.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">חיבור ליומן Google</h2>
        <p>החיבור הוא לבחירתכם ובאישור דרך Google. סדר מבקשת שתי הרשאות לקריאה בלבד: קריאת רשימת היומנים וקריאת האירועים. היא אינה יוצרת, משנה או מוחקת יומנים ואירועים ב־Google, ואינה שולחת לשם משימות.</p>
        <p>לאחר החיבור נשמרים כתובת החשבון, שמות היומנים ופרטי האירועים מהיומנים שבחרתם: כותרת, תאריכים, שעות, מיקום וקישור לאירוע. המידע משמש להצגת האירועים בלוח השנה, בהיום ובבקרוב, ומתעדכן אוטומטית.</p>
        <p>אירועי Google מוצגים בחשבון שחיבר את היומן ואינם משותפים לחברי פרויקטים. מידע זה אינו משמש לפרסום או לאימון מודלי AI. פרטי ההרשאה ל־Google נשמרים מוצפנים; סדר אינה מקבלת את הסיסמה שלכם ל־Google.</p>
        <p>השימוש במידע המתקבל מ־Google כפוף ל־<a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-accent underline underline-offset-4">Google API Services User Data Policy</a>, לרבות דרישות Limited Use.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">בחירה, ניתוק ומחיקה</h2>
        <p>אפשר לבחור אילו יומנים יוצגו או לנתק את Google דרך הגדרות היומן. הניתוק מוחק מסדר את פרטי ההרשאה ואת האירועים שיובאו. אפשר לבטל את ההרשאה גם ב־<a href="https://myaccount.google.com/connections" className="text-accent underline underline-offset-4">חיבורי חשבון Google</a>. היומן המקורי ב־Google נשאר כפי שהוא.</p>
        <p>אפשר למחוק את חשבון סדר דרך הגדרות החשבון. ייתכן שעותקי מידע יישארו בגיבויים שנוצרו לפני המחיקה; גיבויים אלה מיועדים לשחזור השירות.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">יצירת קשר</h2>
        <p>לפניות בנושא המידע שלכם: <a href="mailto:lironatar94@gmail.com" className="text-accent underline underline-offset-4"><bdi dir="ltr">lironatar94@gmail.com</bdi></a>.</p>
      </section>
    </main>
  </div>;
}
