import Image from 'next/image';
import desktopLight from './shots/today-light.png';
import desktopDark from './shots/today-dark.png';
import mobileLight from './shots/today-mobile-light.png';
import mobileDark from './shots/today-mobile-dark.png';

/**
 * The app, shown rather than described.
 *
 * Real light/dark desktop/phone captures of the current `/app/today` UI, using
 * disposable synthetic tasks. Provenance and capture instructions live in
 * `shots/provenance.json`; these are demonstrations, not customer records.
 *
 * Two axes, and they are kept on separate elements on purpose. Brightness is
 * `data-shot`, switched by the rules in globals.css from the same tiers that
 * pick `color-scheme`; viewport is the wrapper's own `md:` class. Putting both
 * on one element loses: the theme selector carries more specificity than a
 * utility class and would drag the phone capture onto the desktop layout.
 *
 * The desktop capture is 1440px of interface. Scaled into a phone it is a grey
 * smudge, which is why the small screen gets the app's own phone layout instead
 * — the same answer the calendar gives, and honest either way.
 */

const ALT =
  'מסך היום בסדר עם נתוני דוגמה: שתי משימות באיחור, חמש משימות להיום, סימון השלמה עגול ושעות מתוזמנות.';

export function ProductShot() {
  return (
    <>
      <div className="mx-auto max-w-[17rem] overflow-hidden rounded-xl shadow-pop md:hidden">
        <Image data-shot="light" src={mobileLight} alt={ALT} sizes="272px" className="h-auto w-full" />
        <Image data-shot="dark" src={mobileDark} alt={ALT} sizes="272px" className="h-auto w-full" />
      </div>

      <div className="hidden overflow-hidden rounded-xl shadow-pop md:block">
        <Image
          data-shot="light"
          src={desktopLight}
          alt={ALT}
          sizes="(min-width: 1216px) 1152px, 100vw"
          className="h-auto w-full"
        />
        <Image
          data-shot="dark"
          src={desktopDark}
          alt={ALT}
          sizes="(min-width: 1216px) 1152px, 100vw"
          className="h-auto w-full"
        />
      </div>
    </>
  );
}
