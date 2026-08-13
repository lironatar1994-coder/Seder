---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/components/landing/parse-demo.tsx","src/components/landing/month-preview.tsx"]
---

Scope: the signed-out landing page at `/` (`src/app/page.tsx`) and the two
components built for it, `components/landing/parse-demo.tsx` and
`components/landing/month-preview.tsx`. Visitor mode: Persuade.

Audience: Israelis looking for a task manager, arriving from a search or a
recommendation, usually already using a translated app. Job: decide in seconds
whether this one is actually Hebrew. Action: open a free account (`/register`);
the secondary path is `/login`.

Proof, in the order the page spends it:
1. The composer demo — a Hebrew sentence typed, parsed, stripped and saved.
   This is the surface's whole argument and it goes first.
2. The month grid, built by `lib/calendar.ts` for the real current month, so
   the gematria, the Rosh Chodesh label and the Israeli weekend are the
   product's own output rather than a mockup, and one task sits on it twice —
   a project chip on the day it is planned, an amber flag on the day it is due.
3. The six standing views and the keyboard, as text.

Constraints: the app's design system is inherited whole and nothing here may
introduce a token, face or component language of its own; the demo mirrors
`task/composer.tsx` and `task/task-row.tsx` exactly, and must be re-checked
against them when either changes. No claim on this page may outrun the
product — there are no user counts, testimonials, ratings, pricing tiers or
integrations to cite, and none may be invented.

Chosen direction: "the sentence that becomes a task" (candidate 3, seed key
seder01). Memorable moment: the recognised words collapsing out of the line,
leaving exactly the title that gets saved. The result row's checkbox is live,
so the completion stroke — the product's one delightful moment — is something
the visitor presses rather than reads about.

Unresolved: nothing about the page is blocked, but the hero currently rests on
a single worked example. If a second example is ever wanted, it belongs inside
the same demo as a second run, not as another section.
