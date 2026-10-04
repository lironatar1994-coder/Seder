import type { MetadataRoute } from 'next';
import { PUBLIC_SITE_URL } from '@/lib/seo';

// Google reads the host-root robots.txt; deployment also preserves its existing
// rules and adds this sitemap there. This route documents Seder's own discovery.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/' }, sitemap: new URL('sitemap.xml', PUBLIC_SITE_URL).href };
}
