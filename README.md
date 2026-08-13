# סדר — Hebrew-first task manager

Production: **[lawebs.co.il/seder](https://lawebs.co.il/seder)** · PM2 process `seder-live` · internal port `3107`.

Deploy from Windows with `./deploy.ps1`. The release script runs the checks, keeps the SQLite
database outside the application directory, creates a database backup, swaps releases with
rollback, applies Prisma migrations, configures nginx and HTTPS, and verifies the service locally.

A personal task manager built the way Todoist and Things for Apple are built, in Hebrew,
right-to-left from the ground up rather than translated.

From **Todoist**: projects, priorities, labels, natural-language quick add, keyboard control.
From **Things**: the Inbox / Today / Upcoming / Anytime / Someday buckets, a deadline that is
separate from the day you plan to work on something, and a quiet surface with one delightful
moment — completing a task.

## Running it

Double-click **`run.cmd`**, or from a terminal:

```powershell
.\run.ps1
```

That is the whole thing. It installs dependencies, creates and seeds the database, starts the
server and opens the browser — skipping whatever is already done, so the second run goes straight
to the server. It seeds a demo account:

```
demo@seder.app  /  demo1234
```

Registering a new account works too — it starts with two projects and three labels so the shape of
the app is legible on the first visit.

| Flag | Effect |
|---|---|
| `-Port 4000` | Serve on another port (default 3000) |
| `-Prod` | Build once and serve the production build |
| `-Fresh` | Delete the database and re-seed. **Destroys local task data.** |
| `-NoOpen` | Do not open a browser |

It stops with a clear message rather than guessing if Node is missing or too old, if the port is
taken, or if `-Fresh` cannot delete the database because a server still has it open.

Prefer npm directly? `npm install && npm run setup && npm run dev` does the same thing.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Vitest — the quick-add parser, the Hebrew calendar, gematria |
| `npm run test:e2e` | Playwright — auth, task flows, and RTL geometry, against a production build on :3100 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Re-seed the demo data |
| `node scripts/shots.mjs` | Screenshots of every view into `screenshots/` |
| `node scripts/console-check.mjs [path…]` | Loads pages as the demo user and reports console/hydration errors |
| `node scripts/contrast-check.mjs` | WCAG audit of the colour tokens in both themes |
| `node scripts/theme-matrix.mjs` | Renders every OS-preference × choice combination and checks what resolved |
| `node scripts/mobile-audit.mjs` | Overflow and touch-target sweep at 320 / 390 / 430px, in a real touch context |
| `node scripts/zoom.mjs <path> <selector> <name>` | Crops one element for close inspection |

The three scripts above sign in by minting a session row directly, so no password is typed
anywhere. They default to `http://localhost:3000`; set `SHOT_BASE` to point elsewhere.

## Quick add

The composer parses Hebrew as you type and shows what it understood as chips before you commit.
Everything it recognises is stripped from the title, so

```
לסיים מצגת מחר בשעה 14:30 #עבודה !1
```

saves a task called exactly `לסיים מצגת`, scheduled for tomorrow at 14:30, in עבודה, priority 1.

| Syntax | Meaning |
|---|---|
| `היום` `מחר` `מחרתיים` | Relative days |
| `יום שלישי` `ביום ה׳` `בשבת` | The next occurrence of that weekday |
| `בעוד 3 ימים` `בעוד שבועיים` `שבוע הבא` `חודש הבא` | Relative offsets |
| `20/8` `20.8.2026` | Day-first dates; a bare date already past rolls to next year |
| `בשעה 14:30` `ב-14:30` `בשעה 9` | Time, 24-hour |
| `עד <date>` `דדליין <date>` | A **deadline**, not a schedule |
| `מתישהו` `בכל עת` | Drop it in Someday / Anytime |
| `כל יום` `כל יומיים` `כל 4 ימים` | Repeat daily |
| `כל שני` `כל יום שני` `כל שני וחמישי` `כל שבת` | Repeat on named weekdays |
| `כל יום עבודה` | Sunday–Thursday |
| `כל שבוע` `כל שבועיים` `כל חודש` `כל שנה` | Repeat by period |
| `#פרויקט` `#"טיול ליוון"` | Project — known multi-word names match without quotes |
| `@תווית` | Label |
| `!1`…`!4` or `p1`…`p4` | Priority |

Unknown project and label names are created rather than silently dropped.

## Calendar

`/app/calendar` — a month grid and a week view, both Sunday-first and running
right-to-left, with Friday and Saturday shaded as the Israeli weekend.

Every cell carries both calendars: the Gregorian day in tabular figures and the Hebrew day in
gematria beside it. The Hebrew month is named once, on Rosh Chodesh, instead of repeating in all
thirty cells.

- **Two kinds of mark.** A scheduled task shows as a chip with its project's colour; a deadline
  shows as an amber flag on its own day. A task with both appears twice — that is the point, and
  collapsing them would throw away the one thing this app models that Todoist does not.
- **Drag to reschedule.** Dropping a chip on another day moves it. Dragging a deadline marker moves
  the deadline and leaves the schedule alone.
- **Day panel.** Clicking a day opens a sheet from the left with that day's tasks and a composer
  already pointed at that date, so `לתאם פגישה` lands on the day you opened.
- **Phone.** Seven columns leave ~50px per day, which is not enough for a title, so small screens
  show coloured dots and the day sheet carries the detail. The week view scrolls sideways instead
  of squeezing.

Keyboard: `←` `→` move a period (left is forward), `T` today, `M` month, `W` week.

The date picker — reachable from the detail panel and from a row's `⋯ → תאריך אחר…` — puts the
common answers on top and a mini month below, with the selected day's Hebrew date in the footer.
Schedule and deadline get their own picker; the deadline one drops the "anytime/someday" rows,
because a deadline is a date or nothing.

## Where a task lives

Two independent axes. Confusing them is the single easiest thing to get wrong in
an app like this, so they are kept apart deliberately.

**Where** — filed into a project, or not. A task with no project is in the **תיבה נכנסת**. That is
all the Inbox means.

**When** — `SCHEDULED` with a date, `ANYTIME`, or `SOMEDAY`. Separately, a task may carry a
**deadline**, which is not the same as the day you plan to work on it.

So a task typed as `לתאם ביקורת מחר` and never filed appears in **both** the Inbox and **בקרוב**.
Giving something a date does not file it; filing it does not unschedule it.

| View | Shows |
|---|---|
| תיבה נכנסת | No project — dated or not |
| היום | Scheduled today or earlier, or a deadline today or earlier |
| בקרוב | Scheduled in the next 30 days, grouped by day |
| בכל עת | Filed, undated, ready to do |
| מתישהו | Explicitly deferred |
| יומן | Completed |

**בכל עת** deliberately excludes unfiled work, so it and the Inbox never say the same thing twice.
**מתישהו** ignores filing, because deferring is an explicit decision either way.

## Repeating tasks

A repeating task is never "finished" — an *occurrence* is. Completing one writes a done copy into
the Logbook and moves the live row on to its next date, so there is only ever one open instance and
the history is real. The toast says `הושלם — חוזר במחר` rather than just "done", and undo reverses
both halves: the copy is deleted and the task rolls back to the date it was on.

A deadline travels with the task by the same number of days, so "work on it Monday, due Wednesday"
stays two days apart every cycle. The checklist resets with each occurrence.

`כל יום שני` typed on a Wednesday starts on the coming Monday; typed on a Monday it starts today.
Rules are also settable from the detail panel, anchored to the task's own date so "כל חודש" means
the day it is actually scheduled for.

The rule set is deliberately small — daily, weekly on named days, monthly on a day-of-month, and
yearly, each with an interval — rather than RRULE. It covers what people type, and every rule can
be read back in Hebrew. Rules serialise to a short string (`weekly:1:0,3`), so the whole feature
costs one nullable column. Month-end is clamped: "the 31st of every month" lands on the 28th in
February rather than skipping into March.

## Settings

`/app/settings`, reachable from the user menu at the foot of the sidebar. Four tabs rather than a
second sidebar — the app already has one on that edge, and nesting another would push the content
off-centre.

Each tab is a column of rows: label and description on the reading edge, control on the far side,
separated by hairlines. Not a stack of cards — a card per setting makes every option look like a
separate destination when what the eye wants is one scannable column.

| Tab | What it holds |
|---|---|
| פרופיל | Display name. Email is shown read-only — changing it needs a verification flow that does not exist yet, and a disabled input would imply it is merely unavailable |
| סיסמה | Current + new + confirm. Requires the current password, and drops every **other** session |
| מראה | Brightness (system / light / dark), accent theme, and the view the app opens on |
| חשבון | Connected devices, sign out everywhere else, and account deletion |

**Appearance is two independent axes**, and they compose: *brightness* (system / light / dark) and
*accent* (seven themes). Any accent works in either brightness, because the accent tokens are
derived from a hue variable while lightness and chroma come from the brightness in force.

Both are absent-means-default. "מערכת" and the default indigo accent write nothing and carry no
attribute, which is exactly what the inline bootstrap script already assumed — it only stamps
`data-theme` / `data-accent` when a choice was made. Picking the default removes the stored value
rather than writing a third one. Both are device-local, like the theme in most apps; the default
view is per-account because it is about the work, not the screen.

**Default view** drives `/app`, which is where sign-in, sign-up and the wordmark all point. A
stored value that no longer matches a view falls back to Today rather than 404ing on the first
screen after signing in.

**Changing the password keeps the current session alive** and drops the others. Signing users out
of the page they are typing on is a bug, not a security measure. Reset-by-email is the opposite: it
drops everything, because there the assumption is that someone else may hold a session.

**Deleting the account** is behind a password, not a checkbox — it is the one irreversible action
in the app, so it earns a modal with protected focus. Every relation cascades from `User`, so the
projects, tasks, labels, sessions and reset tokens go with it.

## Password reset

`/forgot` → emailed link → `/reset/<token>`. The flow is complete and real; only the transport is
configurable.

- The link carries a random 32-byte token and only its SHA-256 is stored, the same shape as
  sessions. It expires after an hour, is burned on use, and at most three can be outstanding per
  account.
- The form says the same thing for a registered and an unregistered address. Anything else turns
  it into a way to check who has an account here.
- Completing a reset **deletes every session for that user**. If the reset happened because someone
  else had access, leaving their session alive would defeat the point.
- The token is re-checked on submit, not just when the page loaded, in case the form sat open past
  the expiry.

**Delivery.** With `SMTP_URL` set the mail is sent for real. Without it — the normal state on a
laptop — the message is printed to the server console rather than silently dropped, so the whole
flow works locally with no mail provider. Set `MAIL_LOG_FILE` to also append messages to a file,
which is how the tests read the link.

```bash
SMTP_URL="smtp://user:pass@smtp.example.com:587"   # omit for console delivery
MAIL_FROM="סדר <no-reply@example.com>"
APP_URL="https://seder.example.com"                # absolute links in emails
```

## Logbook

Grouped by the day each task was finished, newest first, and paged 50 at a time behind a
"טעינת עוד" button — the previous hard cap of 200 made older history simply unreachable.

Pagination is keyset, not offset: the cursor is the last row's `completedAt` and id, so completing
something new while you are reading cannot shift the window and make an entry appear twice or
vanish. When there is nothing more it says so rather than leaving you guessing. There is no
composer — a record of what was done is not somewhere you add work.

## Search

`Ctrl/⌘ K` searches titles and notes as you type and opens the task in place — it does not
navigate you somewhere and leave you to find it. The same palette still jumps to any view, project
or label. Matching happens on the server, so a hit inside a note works even though that text is
nowhere in the visible row.

## Keyboard

| Key | Action |
|---|---|
| `N` | New task |
| `↑` `↓` (or `k` `j`) | Move the selection |
| `Space` | Complete / reopen |
| `Enter` | Open the detail panel |
| `←` `→` | Move the schedule a day later / earlier — **left is forward**, following the reading direction |
| `Ctrl/⌘ K` | Search tasks, or jump to a view |
| `Ctrl/⌘ 1…6` | Jump to a standing view |
| `x` | Add the selected task to the multi-select |
| `Ctrl/⌘ A` | Select every task in the view |
| `Delete` | Delete the selected task |

## On a phone

The phone is not the desk with less room. It is for capture, a glance at what
is due, and ticking things off; planning happens sitting down. The layout says
so:

**A tab bar, not a hamburger.** Four destinations — היום, בקרוב, תיבה נכנסת,
לוח שנה — sit permanently in the thumb arc with their counts. The drawer keeps
what a phone reaches for rarely: projects, labels, settings, sign-out.

**Capture is a slot of its own**, because it is the one thing a phone does
better than a desk — the task occurs to you while you are standing somewhere.
It opens the composer as a sheet on the bottom edge, next to the thumb that
asked for it and above the keyboard about to appear. On a route with no list to
open — the calendar, settings — it navigates to Today and opens there rather
than dropping the tap. The desktop's inline "משימה חדשה" button, and its `N`
badge, are hidden: the tab bar owns capture, and a second one would spend the
fold repeating it.

**The lockup shrinks.** At 1280px the dual-calendar header costs a corner; at
390px it was costing five of the seven rows on screen. It stays the largest
thing on the phone, just not by the same absolute measure, and the sticky top
bar carries the current view so context survives scrolling.

**Touch targets grow, glyphs do not.** Controls keep their density under a
pointer and extend their hit area past their box under a thumb, via a
`::before` under `@media (pointer: coarse)`. Layout is unchanged either way.

**The row menu is visible on touch.** It was `opacity-0 group-hover:opacity-100`,
and a touch screen has no hover — so schedule, move, prioritise and delete were
invisible on every phone since the row was written. The reveal is now gated on
`@media (hover: hover)`.

### Verifying it

```bash
node scripts/mobile-audit.mjs
```

Sweeps five routes at 320 / 390 / 430px for horizontal overflow and for
interactive elements under 44×44, in a context with `hasTouch` set — without
which the page reports `hover: hover` and every touch-only rule quietly keeps
its desktop branch, which is exactly the bug being looked for.

It measures the `::before` hit areas, not just the boxes, and it treats
`visibility: hidden` or `inert` as permission to sit off-screen — which is why
a closed drawer passes and why anything else off-screen does not. It found two
real defects on its first run: the closed drawer kept eleven links in the tab
order, and the month grid's day cell was two buttons tiling one action, neither
tall enough to hit.

One declared exception, named in the script with its reasoning: seven 44px
columns need 308px and a 320px screen has 288, so the month grid cannot meet
the floor there. The fix is an agenda view rather than a size tweak. The script
prints the exception rather than hiding it.

## Architecture

```
prisma/schema.prisma      User · Session · Project · Section · Task · Label · TaskLabel
src/lib/                  Pure logic — parser, dates, gematria, ordering. All unit-tested.
src/server/auth/          argon2 + opaque session tokens
src/server/tasks/         View resolvers (queries.ts) and mutations (actions.ts)
src/server/organization/  Projects, sections, labels
src/components/           ui/ primitives · task/ rows and composer · nav/ shell
src/app/app/[view]/       The six standing views
```

**Auth.** Passwords are argon2id. The cookie carries a random 32-byte token; only its SHA-256
is stored, so a dump of the sessions table hands over nothing usable. Sessions last 30 days and
renew past halfway. `middleware.ts` only checks that a cookie *exists* — Prisma cannot run on the
Edge runtime — and the real verification happens in the authenticated layout one request later.
Wrong email and wrong password give the same message, and repeated failures pause the account.

**Dates.** Every stored calendar date is UTC midnight of the intended day. Storing local midnight
would serialise to the previous day in UTC and every "is this today?" check would be wrong for
half the year. "Today" is resolved in `Asia/Jerusalem`, not on the server clock.

**Ordering.** Positions are fractional-index strings, so a drag writes one row. The client sends
the ids of the new neighbours rather than an index, so a stale list cannot corrupt the order.

**Postgres.** Change the `datasource` provider in `prisma/schema.prisma` to `postgresql` and point
`DATABASE_URL` at the server. Enum-ish columns are deliberately strings so the same schema runs on
both engines; the allowed values live in `src/lib/constants.ts` and are enforced by Zod on write.

## Design

The familiar productivity palette, executed carefully rather than avoided: cool near-white
surfaces, a saturated indigo accent, and amber reserved exclusively for time pressure — deadlines
and overdue — so that colour always means one thing.

The neutrals carry a slight blue cast rather than being warm greys; that is what makes an indigo
accent read as deliberate instead of as a stray colour. One accent token covers link text, focus
ring and filled checkbox, because it clears 4.5:1 both as text and as a fill behind its
`--on-accent` glyph.

Dark mode is not the light theme inverted. The ground is a deep blue-black, surfaces step up in
small increments, and the accent moves the *other* way — light enough to read as text on that
ground, which means filled elements take dark glyphs rather than white ones.

### One declaration per token

Tokens live in `src/app/globals.css`, and each is declared **once**, with both themes inside it:

```css
--paper: #f7f8fa;                                                  /* engines without light-dark() */
--paper: light-dark(oklch(97.6% 0.003 265), oklch(14.5% 0.008 268));
```

`light-dark()` picks its side from the element's `color-scheme`, so the three tiers this used to
need — light, dark-by-media-query, dark-by-attribute — collapse to two selectors that set nothing
but `color-scheme`:

```css
:root                     { color-scheme: light dark; }  /* no choice → the OS decides */
:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='dark']  { color-scheme: dark; }
```

Adding a token is one line, changing a colour is one edit, and a token can no longer be updated in
the light tier and forgotten in the other two. Native controls — scrollbars, date pickers — follow
`color-scheme` for free. The bare hex is the fallback for engines without `light-dark()`; they get
the light theme, which is the safe degradation.

`light-dark()` resolves a `<color>`, not an arbitrary value, so shadows keep their tint in a token
(`--shadow-tint-1`) and write the geometry around it once. No component branches on theme.

### Accent themes

Seven of them — indigo, violet, blue, teal, green, pink, graphite — and each is **one hue number**,
not a hand-picked palette:

```css
[data-accent='green'] { --accent-h: 150; --accent-c: 0.13; --accent-c-dark: 0.13; }
```

Lightness comes from whichever side of the `light-dark()` pair applies, so every accent inherits the
contrast behaviour that was tuned once. Adding a theme is three numbers. Chroma drops on the hues where sRGB cannot hold 0.19
without clipping, since clipping quietly shifts lightness and with it the contrast.

**Amber and red are deliberately absent.** Amber means "time pressure" and red means "highest
priority" everywhere in this app; an accent wearing either would break a meaning the rest of the
interface depends on. For the same reason the priority ramp no longer mirrors the accent — `p3` is
a fixed blue, so switching to the pink theme changes the accent and leaves every flag alone.

### Verifying it

```bash
node scripts/contrast-check.mjs
```

Audits every text-on-surface pair against 4.5:1 and every UI boundary against 3:1 — **7 accents ×
2 modes, 108 pairs** — and exits non-zero on a failure.

It reads `globals.css`, splits each `light-dark()` pair into its two sides, and evaluates the
`oklch()` values the browser actually uses, converting oklch → oklab → linear sRGB → sRGB and
clamping out-of-gamut colours exactly as a browser clamps them. Checking the hex fallbacks would
not do: they exist only for engines without oklch, and the accent themes have none at all.
Parameterising colour by hue is only safe if something proves the whole matrix, so this is what
makes the one-number-per-theme trick honest.

```bash
node scripts/theme-matrix.mjs
```

The contrast checker reads the stylesheet; this reads the *result*. It renders the app in all four
combinations of OS preference and explicit choice and reports the colours the browser computed, so
a change to how themes resolve — `light-dark()`, `color-scheme`, the bootstrap script — cannot pass
on the strength of the CSS alone.

One trap it exists to catch, and which caught the e2e suite too: `getPropertyValue('--paper')`
hands back the literal `light-dark(a, b)` text. Custom properties are substituted at use time, so
the function is only evaluated where something consumes the token — reading a *used* property like
`background-color` is what shows which side won.

Three type roles: **Frank Ruhl Libre** (the 1908 Hebrew book face) for the date lockup and view
titles only, **Assistant** for the interface, and **Inter** with tabular figures for numerals.
16px body floor, 1.7 line-height, word-spacing instead of letter-spacing — Hebrew must never be
letter-spaced.

The signature is the Today header: the weekday and the dual-calendar date — `יום רביעי · כ״ט באב ·
12.08` — sitting on a rail that fills right-to-left as the day closes. ICU converts the calendar
but refuses to render Hebrew numerals (`nu-hebr` silently falls back to Latin digits), so the
gematria in `src/lib/gematria.ts` is hand-built, including the ט״ו/ט״ז rule.

## RTL notes

`<html lang="he" dir="rtl">` plus CSS logical properties throughout — there is no `margin-left`
or `text-align: right` anywhere in `src/`. The handful of genuinely physical things live in one
place each and are flipped per direction:

- `box-shadow` on the detail panel (`.shadow-panel-edge`)
- the mobile drawer's `translateX` (`.drawer` in `globals.css`)
- the completion stroke's `transform-origin` (`.strike-line`) — it is drawn right-to-left
- directional icons (`.icon-flip`)

One trap worth naming: Tailwind's logical **border** utilities are `border-s` / `border-e`, not
`border-is` / `border-ie`. The `is`/`ie` spellings compile to nothing at all — no error, no border,
just a silently missing edge. The block-axis ones (`border-bs` / `border-be`) *are* real, which
makes the inconsistency easy to walk into.

Radix portals mount at `document.body` and assume LTR, so a `DirectionProvider` wraps the app;
without it every menu, popover and command palette opens on the wrong side. Toasts are anchored
with `inset-inline-end`, which is why the Next.js dev indicator is disabled in `next.config.ts` —
it is pinned to the bottom-left and sits directly on top of them.

Every free-text input carries `dir="auto"`, so an English word typed into a Hebrew form resolves
its own direction. Email, time and date fields are forced to `dir="ltr"`. Numerals render inside
`.num`, which isolates them as LTR islands.

## Not built yet

Saved filters, calendar sync, sharing, offline sync, multi-select bulk actions, dragging projects
into a different sidebar order, renaming or reordering sections, email verification on sign-up, and
a formal IS 5568 accessibility certification. The build meets the WCAG AA floor — contrast is encoded at the token layer, focus
is always visible, `prefers-reduced-motion` is respected — but certification is its own pass.

`bulkCompleteAction`, `bulkDeleteAction`, `reorderProjectAction` and `deleteSectionAction` exist in
`src/server/` with no UI calling them. They are the server half of the features listed above;
either wire them up or delete them.

## Known warning

`prisma` prints a deprecation notice about `package.json#prisma`. The seed config still works on
Prisma 6; moving it to `prisma.config.ts` is a Prisma 7 migration task.
