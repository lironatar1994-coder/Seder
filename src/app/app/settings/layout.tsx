import type { Metadata } from 'next';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SETTINGS_SECTIONS } from '@/components/settings/sections';

export const metadata: Metadata = { title: 'הגדרות · סדר' };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-24">
      <header className="pb-4 pt-8">
        <h1 className="display text-4xl font-bold leading-tight text-ink">הגדרות</h1>
      </header>

      {/* Tabs rather than a second sidebar: the app already has one on this
          edge, and nesting a second would push the content off-centre. */}
      <SettingsNav sections={SETTINGS_SECTIONS} />

      <div className="mt-2">{children}</div>
    </div>
  );
}
