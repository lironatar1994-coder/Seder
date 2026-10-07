# Todoist reference study — 2026-10-04

## Layout refinement — 2026-10-08

Rechecked Todoist's official [mobile navigation guide](https://www.todoist.com/help/todoist/features/customize-the-todoist-navigation-bar-L4qpkI0xj) and [date and time guide](https://www.todoist.com/help/todoist/features/schedule-a-date-and-time-for-your-todoist-tasks-q7VobO). The navigation guide removes destinations from Browse when they already have their own bottom tab. Seder follows that disclosure rule and names its Hebrew entry תפריט. Its fixed compact header groups capture and search; only destinations, projects and labels scroll.

The user's date-color rule is Seder's own: today green, tomorrow amber, two through six days ahead blue, seven or more purple. Only the overdue day or today's elapsed hour turns red, never both together. The picker has a visible ללא תאריך action. Task titles grow from 16 to 17px; text, completion controls, metadata and separators share stable row alignment. These refinements preserve the neutral Todoist-inspired canvas and full touch targets.

The user's supplied phone screenshot rejects the previous Seder visual system. This brief
replaces its aesthetic commitments while preserving the app's working features and data.

Primary references inspected:

- [Todoist product interface](https://www.todoist.com/): white task canvas, muted sidebar,
  short Today heading, flat task rows, circular completion controls and brief metadata.
- [Mobile navigation](https://www.todoist.com/help/todoist/features/customize-the-todoist-navigation-bar-L4qpkI0xj):
  default Inbox, Today, Upcoming and Browse destinations. Capture is a separate action.
- [Dynamic Add](https://www.todoist.com/help/todoist/features/use-the-dynamic-add-button-in-todoist-ysybl2M1):
  a dedicated mobile Add control provides fast capture without becoming a destination.
- [View glossary](https://www.todoist.com/help/todoist/get-started/todoist-glossary-cA60laWMH):
  Display contains sorting, grouping and layout settings rather than permanent form controls.
- [Task detail redesign](https://www.todoist.com/inspiration/todoist-new-task-view):
  attributes are labeled, related information is grouped and optional sections can collapse.
  Official desktop and mobile screenshots were inspected directly in the article.

## Decisions for Seder

The first mobile viewport leads with Today, one compact Hebrew/Gregorian date line and the
actual tasks. Eliminate the duplicate mobile toolbar, progress rail and permanent search /
priority / sorting form. Keep display settings in a popover and visibly summarize any active
filter. Move weekly planning and focus into their own reachable screen. A task's Today
metadata shows its time rather than repeating Today on every row. Recurrence is a single
icon with an accessible explanation. Keep a discoverable task menu and labeled detail fields.

Use neutral white / gray in light mode, neutral charcoal in dark mode, and a restrained red
action accent. Project colors and priority semantics remain available. Use Assistant for app
headings and interface text, with tabular isolated numeric times. No serif day headline.

## Execution contract

THESIS: Hebrew tasks are the first readable content, with controls available on demand.
OWN-WORLD: Todoist canon, white canvas, pale gray navigation, sans headings, hairline rows,
round completion controls, one red action accent. Dark mode uses the same neutral grammar.
STORY: capture, see what is due, finish it; reach planning, collaboration and settings via Browse.
FIRST VIEWPORT: at 390px, Today and a compact date precede overdue and Today rows; no permanent
filter form or insight cards. Four quiet navigation destinations and a separate 52px Add button.
FORM: user-pinned Todoist canon overrides assigned candidate 5, seed 95c8c208; code-led.
SIGNATURE: round checkbox tick, strike and row collapse; reduced motion remains immediate.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Quick Add refinement — 2026-10-04

The user rejected the crowded syntax-offer strip. Official references:
[cleaner Quick Add](https://www.todoist.com/zh-CN/help/todoist/product-updates/a-cleaner-simpler-quick-add-june-29-PuIpiLmLh)
and [Task Quick Add](https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz).
Todoist describes a minimal empty state, project/date defaults and optional actions.
These sources informed disclosure and selection behavior; Seder retains Hebrew recognition,
its own recurrence rules and independent schedule/deadline axes.

Replace the seven/eight permanent syntax offers with Date, Project and More. Date selects
an actual day and optional hour. Project searches accessible projects and selects their ID,
so identically named projects do not silently resolve to the wrong ID. The main field stays
a task sentence. More contains priority, deadline, label and repeat choices with a compact
selected-field count. Remove instructional key text; preserve keyboard behavior and an
accessible cancel icon. Preserve natural-language and sigil input.

Explicit clearing survives route defaults. Picking an attribute removes its competing text
tokens while preserving the title and other attributes. Server validation and project
membership remain mandatory. Saving an hour inside the portalled editor must never submit
the task. Focused browser checks cover these interactions, saved attributes and 320px.

Post-release keyboard check: isolate picker keyboard events from the underlying list and calendar. Escape dismisses only the active picker and preserves the composer draft, including on the phone sheet. Native capture-phase dismissal requires its own propagation guard. Scoped regressions cover date/project Escape, phone More Escape, time editing and surrounding list/board/mobile workflows.


## Configurable expanded capture — 2026-10-04

The user corrected the minimal default: show more choices initially and allow later
customization in Settings. [Todoist's Quick Add customization](https://www.todoist.com/zh-CN/help/todoist/features/customize-quick-add-in-todoist-eqRRlZJNN)
(last updated 2026-09-16) documents field visibility, order, text/icon labels,
access to hidden actions through More and preferences shared across platforms.

Seder now defaults to all six supported fields: schedule (including hour), project,
priority, deadline, labels and recurrence. Each visible field opens its real picker
directly. `/app/settings/quick-add` provides a preview, visibility checkboxes, accessible
up/down ordering, text/icon choice, explicit Save and default restoration. Preferences
are stored on the authenticated account with an additive nullable migration; missing
or malformed settings fall back to the complete labeled row. Hidden fields remain
functional in More, which counts selected hidden fields and links to customization.
All pickers retain natural-language reconciliation and keyboard isolation. Controls
wrap on phones; text remains concise and no syntax-offer strip returns.
