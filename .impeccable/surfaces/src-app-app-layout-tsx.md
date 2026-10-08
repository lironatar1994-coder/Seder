---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/app/layout.tsx"
related_targets: ["src/app/layout.tsx", "src/app/app/[view]/page.tsx", "src/app/app/projects/page.tsx", "src/app/app/project/[projectId]/page.tsx", "src/components/nav/workspace-bar.tsx", "src/components/nav/view-header.tsx", "src/components/nav/sidebar.tsx", "src/components/nav/tab-bar.tsx", "src/components/nav/desktop-size.tsx", "src/components/settings/appearance-form.tsx", "src/components/task/task-list.tsx", "src/components/task/task-row.tsx", "src/components/task/task-detail.tsx", "src/components/task/composer.tsx", "src/components/task/project-workspace.tsx", "src/components/task/project-board.tsx", "src/components/ui/button.tsx", "src/app/globals.css", "src/app/fonts.css"]
---

Scope: authenticated Hebrew workspace, visitor mode Operate. Users capture personal
work, plan Today, organize projects and collaborate without losing task context.
Schedule, project placement and deadline remain separate meanings.

Authority: the user-pinned Todoist/Things philosophy and established neutral Seder
world. Preserve Assistant headings/interface, Inter tabular LTR islands, semantic
Lucide icons, pale navigation, flat task rows and circular completion. The user
rejected the lavender ground, dark indigo rail, serif date/progress composition,
permanent Today filters and insight cards on 2026-10-04. The earlier code-led canon
in design/todoist-research.md records seed 95c8c208. The root bootstrap now names
contract desktop-scale-20261009. No image-comp checkpoint or new shipping raster
belongs to this refinement. DESIGN.md owns primitives and .impeccable/design.json
extends them with responsive behavior and component specimens.

Desktop expression (>=1024 CSS px, accepted 2026-10-09): comfortable default uses
19/28px task titles, 17px navigation, 36/44px page headings, 20px sections, 16px
prose/controls, 14px metadata, 22px main icons/list completion and a 280px rail.
Task work has a 960px maximum canvas and 40px gutters anchored beside the right
rail; unused ultra-wide space stays beyond it. Boards, calendar and settings opt
into 82rem; project list restores the ordinary column, including its header.
Task-detail titles use section size with task line height; board titles stay
semibold and board/calendar completion circles retain their existing 20px geometry.

Heading, subtitle, workspace context, composer, group heading, separators and task
title share a derived reading axis. A conditional 28px bulk-selection slot moves
that axis consistently; the distinct 16px selection square and round completion
center on the first title line. Collapsed rail exposes 68px, with reopen,
capture/search, daily, collection and utility glyphs centered at 34px. Accessible
names survive clipped labels. Six sticky daily rows reserve 303px, derived from
46px navigation rows and group framing; at height <=600px the daily group scrolls
with the directory and reserve is zero. Header/capture/search and account/settings
stay anchored, with the collections in a shrinking flex scroll area.

Appearance's immediate device-local size choice coordinates text, symbols and
spacing. Compact uses 17/26px task titles, 15px navigation, 32/40px page headings,
18px sections, 15px prose/controls, 14px metadata, 20px main icons/list controls,
7px row padding and 264px rail. Large uses 21/30px task titles, 18px navigation,
40/48px page headings, 22px sections, 18px prose/controls, 15px metadata, 24px main
icons/list controls, 10px row padding and 296px rail. Comfortable has 8px row
padding; navigation rows remain 46px across choices. Validated local storage is
read before paint and synchronizes across tabs; missing/invalid values use
comfortable. App-body roles allow portalled detail and menus to inherit without
root font-size changes or CSS zoom. Owned settings/property/board text is scoped
to the authenticated shell.

Responsive continuity: at 768–1023px the incumbent tablet shell retains its 256px
rail, 68px collapse, centered 52rem ordinary column and 32px gutters. Below 768px,
Inbox / Today / Upcoming / רשימות remain the four destinations with separate 52px
Add; Browse fills the width above tabs, keeps the active route and count overlays,
anchors header/search/capture/account, makes the main canvas inert and hides
floating Add. Its capture is an accessible icon. Settings hides tabs and Add.
All <=1023 widths retain 17/24px task type and existing mobile/tablet roles;
coarse-pointer navigation and task targets retain a 44px floor. Long text wraps,
with no viewport overflow; board overflow stays local.

Working behavior: Display reveals list search/priority/sort on demand and names
active conditions with reset. Today groups elapsed scheduled times under באיחור;
a shared minute clock and focus/wake refresh use Asia/Jerusalem without moving or
completing tasks. Hebrew capture recognizes sentence tokens before save; its
current default exposes all six fields with direct pickers, concise values and
More. Account-level validated capture preferences control visibility/order/text
and retain hidden fields in More. Project list/board is a device preference, with
dragging and explicit move menus; task links open list mode. Detail's long title
uses an auto-growing dir-auto textarea, sanitizes newlines, saves on blur/Enter
outside composition and refits on font readiness, resize and size changes. Notes,
checklist, labeled properties and comments preserve the task reading order.

Accepted evidence: .local-artifacts/desktop-finish-final.md is a fresh full finish
review of all 19 corrected PNGs in .impeccable/review/desktop-scale/ and returns
ship for this authenticated desktop scope, with no outstanding material findings.
The packet covers 1280/1440/1888/2560 widths, DPR .75, dark, large/settings, long
editor, project list/board, 320/390 mobile, 640/944 reflow, default/large selection
and default/large collapse. metrics.json and source assertions record coincident
heading/composer/title axes, first-line control centers and collapsed glyph centers
within 1px, plus no document overflow. Captures use synthetic local task data.

The repaired DPR .75 capture is 1888x912 from a logical 2517x1216 CSS viewport.
It is renderer-scaling evidence equivalent to those dimensions; 640/944 are CSS
viewport reflow evidence. Neither proves native browser Ctrl+zoom. The reviewer
assessed 1024px/large settings and short-height keyboard positioning from source;
these combinations do not have dedicated new screenshots.

Reported local validation: successful production build, 394 unit cases, contrast
for eight accents in both modes, and 31 unique focused browser cases across
.local-artifacts/desktop-e2e.log (24), desktop-extra.log (6) and
desktop-review-confirm.log (one new desktop case plus two passing duplicates).
The existing .local-artifacts/desktop-detector.json was reused, not rerun: two
inherited spring warnings, two radius advisories and two font advisories outside
the new desktop-role block. Those advisories do not describe the new desktop roles.

Boundaries: this local ship review and documentation do not establish deployment,
live account state or unrelated public/admin review. Signed-out editorial landing,
existing blue brand image, inherited landing screenshot provenance and independent
admin hierarchy remain outside this redesign. No generated or replacement raster
ships; ignored QA PNGs are evidence only. The independent WhatsApp illustration
and its prompt/provenance remain governed by their own surface brief. Focus is a
browser session timer, board mode a device preference, and Google/WhatsApp delivery
require real operator/provider evidence. Do not claim features or delivery from
synthetic demonstration data. Production deployment and live checks remain pending
at this documentation pass.
