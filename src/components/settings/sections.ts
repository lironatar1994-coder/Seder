/** The settings tabs, in order. Kept out of `layout.tsx` because Next only
 *  permits a fixed set of exports from a layout module. */
export const SETTINGS_SECTIONS = [
  { slug: 'profile', label: 'פרופיל' },
  { slug: 'password', label: 'סיסמה' },
  { slug: 'appearance', label: 'מראה' },
  { slug: 'calendar', label: 'יומנים' },
  { slug: 'whatsapp', label: 'וואטסאפ' },
  { slug: 'account', label: 'חשבון' },
] as const;

export type SettingsSectionSlug = (typeof SETTINGS_SECTIONS)[number]['slug'];
