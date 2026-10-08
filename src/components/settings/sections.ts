/** The settings tabs, in order. Kept out of `layout.tsx` because Next only
 *  permits a fixed set of exports from a layout module. */
export const SETTINGS_SECTIONS = [
  { slug: 'profile', label: 'פרופיל', description: 'שם ואימייל' },
  { slug: 'password', label: 'סיסמה', description: 'שינוי הסיסמה' },
  { slug: 'appearance', label: 'מראה', description: 'צבעים, בהירות וצליל השלמה' },
  { slug: 'quick-add', label: 'הוספת משימה', description: 'שדות וברירות מחדל' },
  { slug: 'calendar', label: 'יומנים', description: 'חיבור ליומן Google' },
  { slug: 'whatsapp', label: 'וואטסאפ', description: 'חיבור ותזכורות' },
  { slug: 'account', label: 'חשבון', description: 'התחברויות ומחיקת חשבון' },
] as const;

export type SettingsSectionSlug = (typeof SETTINGS_SECTIONS)[number]['slug'];
