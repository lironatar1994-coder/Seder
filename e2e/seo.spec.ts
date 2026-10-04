import { test, expect } from '@playwright/test';
import { BASE_PATH } from '../playwright.config';
import { PUBLIC_SITE_URL } from '../src/lib/seo';

test('public homepage has one canonical URL and indexable Hebrew metadata', async ({ request, page }) => {
  const redirect = await request.get(`${BASE_PATH}?source=seo`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(new URL(redirect.headers().location, 'http://localhost:3100').href).toBe(`http://localhost:3100${BASE_PATH}/?source=seo`);
  const home = await request.get(`${BASE_PATH}/`, { headers: { 'User-Agent': 'Googlebot' }, maxRedirects: 0 });
  expect(home.status()).toBe(200);
  expect(home.headers()['x-robots-tag']).toBeUndefined();
  const html = await home.text();
  const head = html.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? '';
  expect(head).toContain('name="google-site-verification"');
  expect(head).toContain(`rel="canonical" href="${PUBLIC_SITE_URL}"`);
  await page.goto(`${BASE_PATH}/`);
  await expect(page).toHaveTitle(/ניהול משימות בעברית/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ניהול משימות בעברית');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', PUBLIC_SITE_URL);
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}');
  expect(data['@graph'].map((entry: { '@type': string }) => entry['@type'])).toEqual(['WebSite', 'WebApplication']);
  expect(JSON.stringify(data)).not.toContain('aggregateRating');
  await expect(page.getByRole('heading', { name: 'שאלות על ניהול משימות בסדר' })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local-artifacts/seo-landing-${width}.png`, fullPage: true });
  }
});

test('sitemap contains only the public canonical page and is discoverable', async ({ request }) => {
  const sitemap = await request.get(`${BASE_PATH}/sitemap.xml`);
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('xml');
  const xml = await sitemap.text();
  expect(xml).toContain(`<loc>${PUBLIC_SITE_URL}</loc>`);
  expect(xml.match(/<loc>/g)).toHaveLength(1);
  expect(xml).not.toMatch(/\/app\/|\/login|\/api\/|\/reset/);
  const robots = await request.get(`${BASE_PATH}/robots.txt`);
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${PUBLIC_SITE_URL}sitemap.xml`);
});

test('auth, personal routes and feeds are excluded from search without weakening access', async ({ request }) => {
  for (const path of ['/login', '/register', '/forgot', '/api/health', '/api/calendar/feed/invalid-token', '/app/today']) {
    const response = await request.get(`${BASE_PATH}${path}`, { maxRedirects: 0 });
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    if (path === '/app/today') {
      expect(response.status()).toBe(307);
      expect(response.headers().location).toContain('/login?next=');
    }
  }
  const auth = await request.get(`${BASE_PATH}/login`);
  expect(await auth.text()).toContain('name="robots" content="noindex, nofollow"');
  const slash = await request.get(`${BASE_PATH}/app/today/?from=seo`, { maxRedirects: 0 });
  expect(slash.status()).toBe(308);
  expect(new URL(slash.headers().location, 'http://localhost:3100').href).toBe(`http://localhost:3100${BASE_PATH}/app/today?from=seo`);
});
