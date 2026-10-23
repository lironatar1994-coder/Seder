/** Public, production-only search identity. Never include personal task URLs. */
export const PUBLIC_SITE_URL = 'https://lawebs.co.il/seder/';
// The brand's own line first; the phrase people search for stays in the title.
export const SITE_TITLE = 'סדר (Seder) — מסדר את המשימות שלכם | ניהול משימות בעברית';
export const SITE_DESCRIPTION = 'אפליקציית משימות בעברית: כותבים כמו שמדברים וסדר קובע תאריך ושעה. לוח שנה עברי ולועזי, פרויקטים משותפים ותזכורות בוואטסאפ. בחינם, בטלפון ובמחשב.';
export const SITE_IMAGE = 'https://lawebs.co.il/images/portfolio-shares-20261008/seder.png';
export const SITE_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${PUBLIC_SITE_URL}#website`, name: 'סדר', alternateName: 'Seder', url: PUBLIC_SITE_URL, inLanguage: 'he-IL', description: SITE_DESCRIPTION },
    { '@type': 'WebApplication', '@id': `${PUBLIC_SITE_URL}#application`, name: 'סדר', alternateName: 'Seder', url: PUBLIC_SITE_URL, description: SITE_DESCRIPTION, inLanguage: 'he-IL', applicationCategory: 'BusinessApplication', operatingSystem: 'Web browser', image: SITE_IMAGE, featureList: ['ניהול משימות בעברית', 'תזמון משימות מתוך משפט', 'לוח שנה עברי ולועזי', 'פרויקטים משותפים ותגובות', 'משימות חוזרות ותאריכי הגשה', 'תזכורות בוואטסאפ'] },
  ],
};
