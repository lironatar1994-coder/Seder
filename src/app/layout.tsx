import type { Metadata, Viewport } from 'next';
import { Assistant, Frank_Ruhl_Libre, Inter } from 'next/font/google';
import { DirectionProvider } from '@radix-ui/react-direction';
import { ToastProvider } from '@/components/ui/toast';
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

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d12' },
  ],
};

/* Applies the stored appearance before first paint so the page never flashes
   the wrong theme and then corrects itself. Runs ahead of hydration, hence the
   inline script. Both axes are absent-means-default, so nothing is written for
   "system" or for the default accent. */
const themeBootstrap = `
(function(){try{var d=document.documentElement;var t=localStorage.getItem('seder-theme');if(t==='dark'||t==='light'){d.dataset.theme=t}var a=localStorage.getItem('seder-accent');if(a&&/^[a-z]+$/.test(a)){d.dataset.accent=a}}catch(e){}})();
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
        {/* Radix portals mount at document.body and would otherwise assume LTR,
            opening every menu and popover on the wrong side. */}
        <DirectionProvider dir="rtl">
          <ToastProvider>{children}</ToastProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
