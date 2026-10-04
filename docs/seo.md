# Seder search discovery

The public canonical page is `https://lawebs.co.il/seder/`. Its slash is retained so
the homepage belongs to the Search Console URL-prefix property. `/seder` redirects
permanently to that URL while preserving query parameters; app/auth routes retain
their existing slash-free URLs.

Only this public page is listed in `/seder/sitemap.xml`. Metadata includes a Hebrew
title and description, canonical URL, Open Graph/Twitter image, WebSite and
WebApplication JSON-LD, and the public Google verification tag. Structured data
contains implemented capabilities and has no invented ratings or reviews.
Metadata streaming is disabled so verification and canonical tags appear in the
initial HTML head for every crawler, including Search Console's verifier.

Authentication and personal-workspace layouts emit `noindex, nofollow`. Middleware
also sends `X-Robots-Tag: noindex, nofollow, noarchive` for those paths and APIs,
including calendar feeds. Authentication and membership checks remain mandatory;
search exclusions are not an access-control mechanism.

Google reads `/robots.txt` at the host root, not the subdirectory copy. During
activation, `scripts/publish-seo-discovery.sh` preserves the shared portfolio's
existing rules and sitemap and atomically appends the Seder sitemap line. The
original file is backed up; release rollback also restores the pre-release root
robots file. The portfolio homepage and its sitemap remain independently owned.

After deployment, use the existing Google account in Chrome to verify the
`https://lawebs.co.il/seder/` property, submit `sitemap.xml`, inspect the canonical
homepage, run a live test and request indexing. Verification, successful sitemap
submission, a crawlable page and actual inclusion in search are distinct states.
Neither submission nor structured data guarantees indexing, rankings or a time.

`e2e/seo.spec.ts` checks canonical redirects, indexable public HTML and verification
in `<head>`, sitemap scope, structured-data truth and private-route exclusions.
It also captures the public landing at desktop and phone widths and checks overflow.
The landing product images show the current app with synthetic tasks; their capture
instructions are recorded in `src/components/landing/shots/provenance.json`.

Primary guidance:
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://developers.google.com/search/docs/essentials/technical
