import type { Metadata, Viewport } from 'next';
import { Assistant, Frank_Ruhl_Libre, Inter } from 'next/font/google';
import { DirectionProvider } from '@radix-ui/react-direction';
import { ToastProvider } from '@/components/ui/toast';
import { VisitorSignal } from '@/components/analytics/visitor-signal';
import './globals.css';

/* Three roles, three faces.
   Frank Ruhl Libre is the 1908 Hebrew book face — used only for the date
   lockup and view titles, never for UI chrome.
   Assistant carries the interface: Hebrew-first, clean at 14–16px.
   Inter is a numerals-only utility face, tabular, for dates, times and counts. */
const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-frank',
  display: 'swap',
});

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-assistant',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'סדר — ניהול משימות',
  description: 'מנהל משימות בעברית. היום, בקרוב, מתישהו — הכול במקום אחד.',
};

/* One colour, not a media-query pair: the page no longer resolves against the
   OS, so keying the browser chrome to `prefers-color-scheme` would paint a dark
   bar above a light page on every dark-set device — the common case now. This
   matches --paper in the default theme. Someone who has chosen dark keeps a
   light bar, which is the smaller wrong of the two and the only one a static
   meta tag can avoid. */
export const viewport: Viewport = {
  themeColor: '#f7f8fa',
  /* Lets the page use the full screen behind the notch and the home indicator,
     and — the reason it is here — makes `env(safe-area-inset-*)` report real
     numbers. Without it those insets are zero everywhere, so the tab bar would
     sit under the home indicator on every iPhone while testing clean in a
     desktop browser. */
  viewportFit: 'cover',
  /* The on-screen keyboard shrinks the layout viewport instead of sliding over
     it, so anything pinned to the bottom edge — the composer sheet, the tab
     bar — comes to rest above the keys rather than behind them. The default
     (`overlays-content`) is why bottom-anchored input is a familiar mess on
     mobile web. */
  interactiveWidget: 'resizes-content',
};

/* Applies the stored appearance before first paint so the page never flashes
   the wrong theme and then corrects itself. Runs ahead of hydration, hence the
   inline script. Both axes are absent-means-default, so nothing is written for
   the default brightness (light) or the default accent — and "system", which
   used to be that absence, now stamps an attribute of its own.

   The collapsed sidebar rides along for the same reason: setting it in an
   effect would open the rail, paint, and slam it shut on every load. */
const themeBootstrap = `
(function(){try{var d=document.documentElement;var t=localStorage.getItem('seder-theme');if(t==='dark'||t==='light'||t==='system'){d.dataset.theme=t}var a=localStorage.getItem('seder-accent');if(a&&/^[a-z]+$/.test(a)){d.dataset.accent=a}if(localStorage.getItem('seder-rail')==='collapsed'){d.dataset.rail='collapsed'}}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="he"
      dir="rtl"
      suppressHydrationWarning
      className={`${frank.variable} ${assistant.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <VisitorSignal />
        {/* Radix portals mount at document.body and would otherwise assume LTR,
            opening every menu and popover on the wrong side. */}
        <DirectionProvider dir="rtl">
          <ToastProvider>{children}</ToastProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
