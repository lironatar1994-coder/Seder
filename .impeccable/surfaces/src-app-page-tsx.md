---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/components/landing/parse-demo.tsx","src/components/landing/month-preview.tsx","src/components/landing/product-shot.tsx"]
---

Scope: the signed-out landing page at `/` (`src/app/page.tsx`) and the three
components built for it — `components/landing/parse-demo.tsx`,
`month-preview.tsx`, and `product-shot.tsx`. Visitor mode: Persuade.

Audience: Israelis looking for a task manager, arriving from a search or a
recommendation, usually already using a translated app. Job: decide in seconds
whether this one is actually Hebrew. Action: open a free account (`/register`);
the secondary path is `/login`.

Proof, in the order the page spends it:
1. The composer demo — a Hebrew sentence typed, parsed, stripped and saved.
   This is the surface's whole argument and it goes first.
2. The interface itself, at close to life size, on a stepped-down ground. Real
   captures from `scripts/shots.mjs`, four files (desktop and phone × light and
   dark) under `components/landing/shots/`. Regenerate them when the app's
   chrome changes; a stale screenshot is the fastest way for this page to start
   lying.
3. The month grid, built by `lib/calendar.ts` for the real current month, so
   the gematria, the Rosh Chodesh label and the Israeli weekend are the
   product's own output rather than a mockup, and one task sits on it twice —
   a project chip on the day it is planned, an amber flag on the day it is due.
4. The six standing views and the keyboard, as text.

Two measures, and the rule is deliberate: prose sits on `max-w-5xl`, and the two
things worth looking at — the interface and the month — get `max-w-6xl`. Grounds
alternate paper / `surface-sunk` to pace the scroll and to keep the screenshot,
whose own background is `--paper`, from bleeding into the page.

Constraints: the app's design system is inherited whole and nothing here may
introduce a token, face or component language of its own; the demo mirrors
`task/composer.tsx` and `task/task-row.tsx` exactly, and must be re-checked
against them when either changes. No claim on this page may outrun the
product — there are no user counts, testimonials, ratings, pricing tiers or
integrations to cite, and none may be invented. That rules out the social-proof
band both reference products lead with; what replaces it is showing the thing
working.

Chosen direction: "the sentence that becomes a task" (candidate 3, seed key
seder01). Memorable moment: the recognised words collapsing out of the line,
leaving exactly the title that gets saved. The result row's checkbox is live,
so the completion stroke — the product's one delightful moment — is something
the visitor presses rather than reads about.

Unresolved: nothing about the page is blocked. If a second worked example is
ever wanted, it belongs inside the demo as a second run, not as another section.
