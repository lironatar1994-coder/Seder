import type { Metadata } from 'next';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SETTINGS_SECTIONS } from '@/components/settings/sections';

export const metadata: Metadata = { title: 'הגדרות · סדר' };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    /* `data-wide` opts out of the 44rem reading column. Settings is not prose:
       it is a list of controls, and squeezed into a reading measure it became a
       narrow strip of labels with a long empty page under it.

       The section list is a column here rather than the tab strip it used to
       be. The original reason for tabs — the app already has a sidebar on this
       edge and a second would push the content off-centre — held while settings
       shared the reading column. Given the full width, a column of sections is
       the shape every settings screen worth copying uses, and it scales past
       the four we have without becoming a scroller. */
    <div data-wide className="pb-24">
      <header className="pb-5 pt-8">
        <h1 className="display text-4xl font-bold leading-tight text-ink">הגדרות</h1>
      </header>

      <div className="gap-10 md:grid md:grid-cols-[13rem_minmax(0,44rem)] md:items-start">
        <SettingsNav sections={SETTINGS_SECTIONS} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
