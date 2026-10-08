import type { Metadata, Viewport } from 'next';
import { DirectionProvider } from '@radix-ui/react-direction';
import { ToastProvider } from '@/components/ui/toast';
import { VisitorSignal } from '@/components/analytics/visitor-signal';
import { SITE_DESCRIPTION } from '@/lib/seo';
import './fonts.css';
import './globals.css';

/* Assistant carries the authenticated workspace, including its headings.
   Frank Ruhl Libre retains the public/editorial display role.
   Inter provides tabular numerals for dates, times and counts. */

export const metadata: Metadata = {
  metadataBase: new URL('https://lawebs.co.il'),
  title: 'סדר — ניהול משימות',
  description: SITE_DESCRIPTION,
};

/* One colour, not a media-query pair: the page no longer resolves against the
   OS, so keying the browser chrome to `prefers-color-scheme` would paint a dark
   bar above a light page on every dark-set device — the common case now. This
   matches --paper in the default theme. Someone who has chosen dark keeps a
   light bar, which is the smaller wrong of the two and the only one a static
   meta tag can avoid. */
export const viewport: Viewport = {
  themeColor: '#ffffff',
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
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <div hidden data-design-contract dangerouslySetInnerHTML={{ __html: '<!-- THESIS: Hebrew tasks first; daily views anchor navigation and collections supply context. OWN-WORLD: user-pinned Todoist and Things conventions, neutral surfaces, Assistant, semantic icons, quiet selected rows, round task controls. STORY: capture, plan, finish; projects organize work and Browse reveals the remaining destinations. FIRST VIEWPORT: compact task canvas; desktop sticky daily lists above collapsible projects, saved filters and labels, with anchored account/settings; mobile Inbox, Today, Upcoming and Browse retain route identity and counts, with separate Add. FORM: code-led established Seder world, precisely pinned navigation extension, navigation-20261008. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->' }} />
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
