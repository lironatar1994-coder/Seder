---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/app/layout.tsx"
related_targets: ["src/app/app/[view]/page.tsx", "src/app/app/filters/page.tsx", "src/app/app/projects/page.tsx", "src/app/app/project/[projectId]/page.tsx", "src/components/nav/workspace-bar.tsx", "src/components/task/task-list.tsx", "src/components/task/task-row.tsx", "src/components/task/composer.tsx", "src/components/task/filter-builder.tsx", "src/components/task/today-insights.tsx", "src/components/task/project-workspace.tsx", "src/components/task/project-board.tsx", "src/app/globals.css", "src/app/fonts.css"]
---

Scope: the authenticated Hebrew workspace. Visitor mode: Operate. Its users capture
personal tasks, plan their day and collaborate with friends inside shared projects.
The task is to move from a Hebrew sentence to clear work, then assign, discuss and
complete it without losing task context.

Direction: extend the inherited world with the user-pinned Todoist-like operating
grammar. This is an existing-world extension; no new-world seed or decision comp
applies. Root DESIGN.md records the built shared visual rules. The signed-out landing
brief remains independently owned and unchanged.

Working story: capture a Hebrew sentence; plan Today using schedule and deadline as
separate axes; narrow work with quick or saved filters; organize a project as a list
or board; invite collaborators, assign responsibility, comment and complete tasks.
The live task collection is the main content throughout.

First viewport: desktop keeps the existing right navigation rail and adds breadcrumb,
search and shortcut access above the main view. Today places its date/progress lockup
over tasks, with week outlook, focus and deadlines in the supporting margin where
space permits. Mobile retains compact top/bottom navigation and starts with tasks;
planning sections follow. The board is deliberately horizontally scrollable inside
the content area and initially opens at its first populated column on phones.

Distinctive behavior: the Hebrew composer visibly recognizes sentence tokens before
saving. Task completion provides the existing reading-direction feedback. Filter
saving reads the currently visible search/criterion fields, even before applying
them; applying remains a separate navigation action. Board cards support both pointer
dragging and an explicit move menu; list/board preference persists per project in the
browser. Opening a task link chooses the list so the detail remains reachable.

Review evidence: `.impeccable/review/desktop.png`, `mobile.png`, `phone-320-dark.png`,
`filters.png`, `projects.png`, `board.png`, and `board-mobile.png`. The reviewer returned
`ship` for the two resolved findings: saving the current visible filter fields and
opening the mobile board on a populated column. That verdict is scoped to those fixes.
Existing short spring-token detector warnings were judged immaterial by the reviewer.

Raster provenance: this workspace change created no generated or replacement shipping
rasters. Review PNGs are local captures of seeded demonstration state, not customer
data. The preserved landing images in `src/components/landing/shots/` are inherited
real interface captures containing synthetic demo content; they are not newly
generated imagery and may show an older workspace composition/date. Refreshing those
landing demonstrations is outside this authenticated-surface change.

Known limits: focus is a browser session timer, not team presence or a productivity
measure. Board mode is a browser preference, not a synchronized team setting. Local
captures and the fix verdict do not by themselves verify a production deployment.
Future visual work must use the real task and collaboration states, and cannot claim
new capabilities from the demonstration data.
