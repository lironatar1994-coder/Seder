---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/app/layout.tsx"
related_targets: ["src/app/layout.tsx", "src/app/app/[view]/page.tsx", "src/app/app/focus/page.tsx", "src/app/app/filters/page.tsx", "src/app/app/projects/page.tsx", "src/app/app/project/[projectId]/page.tsx", "src/components/nav/workspace-bar.tsx", "src/components/nav/view-header.tsx", "src/components/nav/sidebar.tsx", "src/components/nav/tab-bar.tsx", "src/components/task/task-list.tsx", "src/components/task/task-row.tsx", "src/components/task/task-detail.tsx", "src/components/task/composer.tsx", "src/components/calendar/entry-row.tsx", "src/components/task/filter-builder.tsx", "src/components/task/today-insights.tsx", "src/components/task/project-workspace.tsx", "src/components/task/project-board.tsx", "src/app/globals.css", "src/app/fonts.css"]
---

Scope: the authenticated Hebrew workspace. Visitor mode: Operate. Its users capture
personal tasks, plan their day and collaborate with friends inside shared projects.
The task is to move from a Hebrew sentence to clear work, then assign, discuss and
complete it without losing task context.

Direction: a user-authorized replacement after the 2026-10-04 rejection of the
lavender ground, dark indigo rail, serif date/progress composition and crowded Today
controls. The user pinned Todoist's actual operating grammar. This is a code-led
replacement: assigned candidate 5 is overridden by that authority; the execution
contract records seed 95c8c208 in design/todoist-research.md and the root layout.
No approved image comp or hero-reproduction checkpoint applies. Root DESIGN.md
records the final implemented world and .impeccable/design.json carries its actual
primitives. The signed-out landing remains an independent editorial surface outside
this replacement finish review; its older brief is not authority over app hierarchy.

Working story: capture a Hebrew sentence; plan Today using schedule and deadline as
separate axes; narrow work with quick or saved filters; organize a project as a list
or board; invite collaborators, assign responsibility, comment and complete tasks.
The live task collection is the main content throughout.

First viewport: desktop uses pale neutral right navigation, quiet contextual search
and a white task canvas. Today starts with a short Assistant heading, one compact
Gregorian/Hebrew date line and flat task groups. Display opens search, priority and
sort controls on demand; all active conditions remain named in a compact summary
with reset. No permanent filter form, progress rail or insight cards occupies Today.
The weekly outlook, deadlines and browser timer are reachable at /app/focus.

Mobile uses four destinations — Inbox, Today, Upcoming and Browse — with a separate
52px Add action. Browse fills the width above the persistent tab bar, exposes the
remaining views/projects/settings and offers its own labeled Add row. Today keeps
actual tasks in the first viewport without a duplicate top toolbar. The 390px
capture fits seven task rows above navigation; the user-reported 576px width and
320px dark mode retain the same reading order without page overflow. Calendar
scheduled rows use 20px circles with a 1.5px priority outline and 16px titles;
deadline entries retain their separate non-completing meaning. Board scrolling is
deliberately local and initially opens on a populated column on phones.

Distinctive behavior: the Hebrew composer visibly recognizes sentence tokens before
saving. Task completion provides the existing reading-direction feedback. Filter
saving reads the currently visible search/criterion fields, even before applying
them; applying remains a separate navigation action. Board cards support both pointer
dragging and an explicit move menu; list/board preference persists per project in the
browser. Opening a task link chooses the list so the detail remains reachable.

Review evidence: .impeccable/review/todoist/ contains desktop.png, mobile.png,
user-576.png, mobile-320-dark.png, browse-mobile.png, display-mobile.png,
active-display-mobile.png, detail-mobile.png, composer-mobile.png, focus-mobile.png,
settings-mobile.png, calendar-mobile.png, projects-desktop.png and upcoming-desktop.png.
All fourteen captures were inspected. Their synthetic account is labeled as example
data; no customer content is used.

The full finish review in .local-artifacts/todoist-finish-review.md returned fix for
two material findings: the Display summary omitted simultaneous conditions, and
calendar rows retained square completion controls and small titles. The bounded
verdict in .local-artifacts/todoist-finish-verdict.md returns ship for those two
resolved fixes and their introduced regressions only. It is not a new whole-surface
review. Existing short spring-token warnings were judged immaterial in that review.
Validation reported 320 unit tests, contrast across all eight accents in both
brightness modes, and the final production-build browser suite at 84/84 passed
(.local-artifacts/todoist-final-e2e.log). Deployment remains a separate pending gate
at the time of this documentation pass.

Raster provenance: this code-led replacement creates no generated or replacement
shipping raster. Review PNGs are local captures of synthetic demonstration state.
The existing blue brand image is preserved. The landing images in
src/components/landing/shots/ are inherited interface captures containing synthetic
demo content; they may show an older composition/date and have not been recertified
by this authenticated finish review.

The separate WhatsApp introduction/settings illustration and its exact prompt are
preserved. Provenance remains in design/assets/whatsapp-reminder-preview.prompt.txt
and public/images/whatsapp-reminder-preview.webp.json; its separate review is recorded
in src-components-nav-whatsapp-introduction-tsx.md. This task does not create delivery
proof or recertify that extension.

Known limits: focus is a browser session timer, not team presence or a productivity
measure. Board mode is a browser preference, not a synchronized team setting. Local
captures, passing tests and the fix verdict do not by themselves verify a production
deployment. Google OAuth availability requires operator configuration and a real
provider connection; a connection link or synthetic event is not proof it is active.
Future visual work must use the real task and collaboration states, and cannot claim
new capabilities from the demonstration data.
