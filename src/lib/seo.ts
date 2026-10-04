/** Public, production-only search identity. Never include personal task URLs. */
export const PUBLIC_SITE_URL = 'https://lawebs.co.il/seder/';
export const SITE_TITLE = 'סדר (Seder) — ניהול משימות בעברית ופרויקטים משותפים';
export const SITE_DESCRIPTION = 'סדר הוא מנהל משימות בעברית: כותבים משפט ומקבלים משימה מתוזמנת, מתכננים ביומן עברי ולועזי ומשתפים פרויקטים עם חברים. מתאים למחשב ולטלפון.';
export const SITE_IMAGE = 'https://lawebs.co.il/seder/brand/seder-logo-v2.png';
export const SITE_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${PUBLIC_SITE_URL}#website`, name: 'סדר', alternateName: 'Seder', url: PUBLIC_SITE_URL, inLanguage: 'he-IL', description: SITE_DESCRIPTION },
    { '@type': 'WebApplication', '@id': `${PUBLIC_SITE_URL}#application`, name: 'סדר', alternateName: 'Seder', url: PUBLIC_SITE_URL, description: SITE_DESCRIPTION, inLanguage: 'he-IL', applicationCategory: 'BusinessApplication', operatingSystem: 'Web browser', image: SITE_IMAGE, featureList: ['ניהול משימות בעברית', 'תזמון משימות מתוך משפט', 'לוח שנה עברי ולועזי', 'פרויקטים משותפים ותגובות', 'משימות חוזרות ותאריכי הגשה'] },
  ],
};
