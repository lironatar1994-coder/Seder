import Link from 'next/link';
import { ChevronLeft, UserRound, KeyRound, Palette, PlusCircle, CalendarDays, MessageCircle, Shield } from 'lucide-react';
import { SETTINGS_SECTIONS } from './sections';

const icons = [UserRound, KeyRound, Palette, PlusCircle, CalendarDays, MessageCircle, Shield];
export function SettingsOverview() {
  return <nav aria-label="בחירת הגדרה" data-testid="settings-overview">
    <ul className="divide-y divide-line border-y border-line">
      {SETTINGS_SECTIONS.map((section, index) => {
        const Icon = icons[index];
        return <li key={section.slug}>
          <Link href={`/app/settings/${section.slug}`} aria-label={section.label} aria-describedby={`settings-${section.slug}-description`} className="flex min-h-[4.5rem] items-center gap-3 px-1 py-3 transition-colors hover:bg-surface-2">
            <Icon className="size-5 shrink-0 text-muted" strokeWidth={1.7} aria-hidden />
            <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-ink">{section.label}</span><span id={`settings-${section.slug}-description`} className="mt-0.5 block text-sm text-muted">{section.description}</span></span>
            <ChevronLeft className="size-4 text-muted" aria-hidden />
          </Link>
        </li>;
      })}
    </ul>
  </nav>;
}
