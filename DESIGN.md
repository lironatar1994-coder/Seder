---
name: "סדר"
description: "Hebrew task capture, personal planning and shared projects."
colors:
  paper: "light-dark(oklch(97.4% calc(var(--accent-c) * 0.045) var(--accent-h)), oklch(14.5% calc(var(--accent-c-dark) * 0.06) var(--accent-h)))"
  surface: "light-dark(oklch(100% 0 0), oklch(19.5% 0.009 268))"
  surface-2: "light-dark(oklch(95.8% 0.005 265), oklch(24% 0.01 268))"
  surface-sunk: "light-dark(oklch(94.6% 0.006 265), oklch(11.5% 0.007 268))"
  ink: "light-dark(oklch(17.5% 0.008 270), oklch(93% 0.005 268))"
  ink-2: "light-dark(oklch(33.5% 0.014 265), oklch(78% 0.011 268))"
  muted: "light-dark(oklch(47.5% 0.019 265), oklch(63% 0.016 268))"
  line: "light-dark(oklch(91.5% 0.005 265), oklch(25.5% 0.01 268))"
  line-strong: "light-dark(oklch(84% 0.011 265), oklch(33% 0.013 268))"
  rail: "light-dark(oklch(28% calc(var(--accent-c) * 0.32) var(--accent-h)), oklch(11.5% calc(var(--accent-c-dark) * 0.28) var(--accent-h)))"
  rail-ink: "light-dark(oklch(96% calc(var(--accent-c) * 0.05) var(--accent-h)), oklch(93% calc(var(--accent-c-dark) * 0.04) var(--accent-h)))"
  rail-muted: "light-dark(oklch(74% calc(var(--accent-c) * 0.14) var(--accent-h)), oklch(66% calc(var(--accent-c-dark) * 0.12) var(--accent-h)))"
  rail-line: "light-dark(oklch(35% calc(var(--accent-c) * 0.3) var(--accent-h)), oklch(19% calc(var(--accent-c-dark) * 0.25) var(--accent-h)))"
  rail-hover: "light-dark(oklch(33.5% calc(var(--accent-c) * 0.34) var(--accent-h)), oklch(16.5% calc(var(--accent-c-dark) * 0.3) var(--accent-h)))"
  rail-active: "light-dark(oklch(39% calc(var(--accent-c) * 0.45) var(--accent-h)), oklch(22% calc(var(--accent-c-dark) * 0.42) var(--accent-h)))"
  accent: "light-dark(oklch(50% var(--accent-c) var(--accent-h)), oklch(70% var(--accent-c-dark) var(--accent-h)))"
  accent-hover: "light-dark(oklch(44% var(--accent-c) var(--accent-h)), oklch(76% calc(var(--accent-c-dark) * 0.92) var(--accent-h)))"
  accent-soft: "light-dark(oklch(94.5% calc(var(--accent-c) * 0.14) var(--accent-h)), oklch(24% calc(var(--accent-c-dark) * 0.38) var(--accent-h)))"
  on-accent: "light-dark(oklch(100% 0 0), oklch(14.5% 0.008 268))"
  flag: "light-dark(oklch(50% 0.128 58), oklch(76% 0.13 70))"
  flag-soft: "light-dark(oklch(96% 0.024 75), oklch(24% 0.035 70))"
  p1: "light-dark(oklch(46.5% 0.17 27), oklch(72% 0.13 20))"
  p2: "light-dark(oklch(50% 0.128 58), oklch(76% 0.13 70))"
  p3: "light-dark(oklch(50% 0.19 268), oklch(70% 0.155 272))"
  p4: "light-dark(oklch(59.5% 0.015 265), oklch(59% 0.014 268))"
  swatch-teal: "light-dark(#0d9488, #2dd4bf)"
  swatch-clay: "light-dark(#ea580c, #fb923c)"
  swatch-plum: "light-dark(#7c3aed, #a78bfa)"
  swatch-moss: "light-dark(#16a34a, #4ade80)"
  swatch-slate: "light-dark(#64748b, #94a3b8)"
  swatch-rose: "light-dark(#e11d48, #fb7185)"
typography:
  display:
    fontFamily: "Frank Ruhl Libre, Noto Serif Hebrew, Georgia, serif"
    fontSize: "3.25rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  title:
    fontFamily: "Frank Ruhl Libre, Noto Serif Hebrew, Georgia, serif"
    fontSize: "2.375rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Assistant, Segoe UI, Heebo, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "Assistant, Segoe UI, Heebo, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "normal"
  metadata:
    fontFamily: "Assistant, Segoe UI, Heebo, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    letterSpacing: "normal"
  numerals:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontFeature: "tnum"
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.625rem"
  xl: "0.875rem"
  task-surface: "0.75rem"
  work-container: "0.9rem"
  planning-card: "1rem"
  full: "9999px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
  8: "2rem"
  12: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.lg}"
    height: "2.75rem"
    padding: "0 1rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "2.75rem"
    padding: "0 1rem"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.lg}"
    height: "2.75rem"
    padding: "0 1rem"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.p1}"
    rounded: "{rounded.lg}"
    height: "2.75rem"
    padding: "0 1rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 0.75rem"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "0.6rem"
    height: "2.5rem"
    padding: "0 1rem"
  task-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.task-surface}"
    padding: "0.25rem"
---

# Design System: סדר

## Overview

**Creative North Star: "A clear place for Hebrew work"**

This records the built, inherited visual world: a dark indigo navigation rail beside cool paper and white task surfaces. It supports Hebrew capture, planning and shared projects with familiar task-manager affordances. Dense working content stays legible; color and display type establish orientation without competing with tasks.

The interface is Hebrew-first and RTL. Assistant carries everyday controls, Frank Ruhl Libre gives the wordmark and view titles their character, and Inter keeps numbers stable. The default appearance is light; explicit dark and system modes use the same semantic structure. Seven accent choices change the navigation and action family while urgency colors remain fixed.

**Key Characteristics:**
- Tasks lead; planning information supports them from a margin or follows them on small screens.
- Cool tonal surfaces, gentle corners and restrained elevation.
- Hebrew display titles paired with a practical interface face and isolated numerals.
- A stable navigation frame, explicit state and visible capture affordances.

## Colors

The frontmatter preserves the canonical CSS color pairs and theme variables from `src/app/globals.css`; fallback hex declarations are compatibility values, not a second palette.

### Primary
- **Action Indigo:** `accent`, `accent-hover`, `accent-soft` and `on-accent` express capture, selected controls, completion and focus. Indigo is the resting accent; violet, blue, teal, green, pink and graphite are supported appearance choices.
- **Indigo Rail:** the `rail` family is an independent dark surface with its own text, divider, hover and current-page values. Shared controls inside it inherit rail-aware neutral tokens.

### Secondary
- **Deadline Amber:** `flag` and `flag-soft` identify upcoming deadline pressure. Priority 2 uses the matching fixed amber family through `p2`.
- **Urgency Red:** `p1` marks priority 1, destructive/error feedback and overdue dates. Completed dates lose overdue emphasis. This is the built behavior, even where older token comments describe amber more broadly.
- **Fixed Priority Indigo and Gray:** `p3` and `p4` belong to priority state, independent of the selected accent.
- **Project Swatches:** teal, clay, plum, moss, slate and rose distinguish projects and labels at dot or chip scale; they do not replace the main action family.

### Neutral
- **Cool Paper:** `paper` is the accent-tinted ground.
- **White Work Surface:** `surface` contains task groups, cards, inputs and popovers; dark mode steps above its blue-black ground.
- **Quiet Layers:** `surface-2` and `surface-sunk` distinguish tracks, grouped controls and recessed areas.
- **Ink / Secondary Ink / Muted:** the three text levels convey hierarchy; `line` and `line-strong` divide content and outline controls.

**The Stable Meaning Rule.** Appearance changes action and navigation color; priority, deadline and project identities remain separately named semantic families.

## Typography

**Display Font:** Frank Ruhl Libre, with Noto Serif Hebrew and serif fallbacks.
**Body Font:** Assistant, with Segoe UI, Heebo and sans-serif fallbacks.
**Numeral Font:** Inter, with tabular figures and LTR isolation.

All three are self-hosted variable fonts in `public/fonts`; their licenses ship beside the files. The display face marks places and dates, while task titles stay in the interface face. Hebrew uses normal letter spacing; body word spacing is slightly open (`0.05em`).

### Hierarchy
- **Display:** the Today weekday uses the display role on desktop and contracts to `2rem` on mobile.
- **Title:** ordinary view and project titles use the title role; project titles may use the project's swatch.
- **Body:** prose starts at the body role. Task titles retain its size with a compact line height (`1.375`).
- **Label / Metadata:** labels and supporting notes use the smaller interface scale; counts and time strings use the numeral face.
- **Panel headings:** compact Assistant headings (`1rem`, bold) keep week, deadline and board sections subordinate to the view title.

**The Hebrew Reading Rule.** Preserve RTL reading order, normal Hebrew letter spacing and isolated LTR islands for times, dates, shortcuts and counts. User-entered task and project titles resolve with `dir="auto"`.

## Layout

The authenticated shell occupies the viewport. Its content column scrolls independently; the navigation stays anchored. Desktop uses a right rail (`16rem`), collapsible to an icon strip (`4.25rem`), and a white breadcrumb/action bar with a minimum height of `4.25rem`. The main container uses `50rem` for ordinary views and expands to `82rem` for marked wide surfaces, with horizontal padding increasing from `1rem` to `2rem` at the desktop navigation breakpoint (`48rem`).

Today keeps the task column first in reading order. From `1280px`, its support margin is `17rem`, separated by a hairline and a `3rem` grid gap; below that width planning sections follow the task list, with two columns where space permits. Below `768px` the layout becomes one column, the desktop breadcrumb bar disappears, and the compact top bar plus fixed bottom navigation take over. Bottom clearance comes from the shared safe-area-aware navigation token.

Task groups sit on white surfaces with hairline row dividers and a minimum row height of `3.5rem`; richer metadata may increase height. Toolbars wrap their search onto its own mobile row. Project directories use an auto-filling grid with a `17rem` minimum card width. Boards scroll horizontally: columns are `19rem` on desktop and shrink to the viewport minus `3rem` on mobile; the page itself remains contained.

**The Task First Rule.** Capture and working tasks retain the first useful viewport. Planning panels move after tasks on mobile rather than consuming that viewport.

## Elevation & Depth

Tonal separation and hairlines do most of the work. Small buttons and draggable cards use a shallow shadow; overlays and lifted objects use the popover shadow. The detail panel uses a directional edge shadow. These geometries stay theme-aware through the shadow tint family and are recorded in `.impeccable/design.json`.

Motion makes state comprehensible: short color changes for controls, a spring for the rail's physical width, quiet content transitions, and an RTL completion stroke followed by row collapse. Recognized quick-add words and newly placed rows also receive brief feedback. Reduced-motion settings suppress animation and preserve readable end states.

**The Grounded Depth Rule.** Keep resting task groups flat; use elevation to distinguish a floating control, a popover or an object being moved.

## Shapes

The shape vocabulary is gently curved: small metadata chips, compact rounded controls, and larger corners on task groups, board columns and planning cards. Use the frontmatter's named scales; existing local containers retain their observed corners rather than being forced into one radius. Hairlines are light and continuous. Dashed borders identify the board's add-section affordance.

List completion is a rounded square; bulk selection is a smaller circle. Board completion currently uses a circle. Those controls carry different contextual behavior and must retain explicit labels and checked state.

## Components

### Buttons

Confident but quiet. Primary buttons use the accent and a shallow shadow; secondary buttons use the surface with a stronger hairline; ghost buttons gain a quiet surface on hover; destructive buttons use fixed urgency red. Default controls are `2.75rem` high; compact controls are `2.25rem` and grow on coarse pointers. Disabled controls reduce opacity and stop interaction. Focus uses the common accent outline (`2px`, offset `2px`).

### Inputs / Fields

Surface-backed, gently rounded fields have a stronger neutral outline, accent border on focus and red invalid feedback. They inherit the body text size, use automatic content direction where appropriate, and increase their touch height on coarse pointers. The filter builder groups search and four explicit criteria in one white container, using a two-column mobile field grid and four desktop columns.

### Chips

Filter choices are quiet white controls, becoming accent wash with stronger type when selected. Task metadata stays compact: deadline flags use semantic urgency, project chips use a small swatch dot, and labels use a translucent wash of their own color. Default priority 4 has no flag. Meaning is supported by icons, labels and accessible names rather than color alone.

### Cards / Containers

Task groups are white, lightly padded surfaces with internal dividers. Board columns use the second surface layer, and their task cards use white with a shallow shadow. A drag target becomes accent-soft; a dragged card gains the popover shadow. Directory cards contain project identity, task totals and a thin completion bar. The focus timer uses the accent wash rather than an elevated dashboard tile.

### Navigation

The rail uses inverted text hierarchy and full-row hover/active backgrounds. Capture is a high-contrast, full-width action near its top. Labels fade when it collapses while icons retain stable positions. Mobile uses the existing drawer plus four frequent destinations and a separate capture slot in the bottom bar. Hidden drawers leave the keyboard and accessibility tree; touch menus remain reachable without hover.

### Hebrew Composer and Date Lockup

Quick-add recognizes parts of a Hebrew sentence in place, showing semantic highlights before saving; an accessible live description conveys the parse. The Today header combines a large weekday, Hebrew date and isolated Gregorian date above an RTL progress hairline. The count reflects completed tasks, and appears only when a nonzero total exists.

### Project Workspace

The list/board switch is a recessed segmented control with a white selected segment, pressed state and a small shadow. Share is an explicit adjacent action; assignment and comments belong with tasks. Board moves support a labeled select menu in addition to pointer dragging. On phones the board initially positions the first populated column in view while retaining empty drop targets.

## Do's and Don'ts

### Do:
- **Do** inherit the semantic color tokens in both themes and retain the rail's local neutral remapping.
- **Do** keep Hebrew task titles readable, metadata subordinate and task controls explicitly labeled.
- **Do** preserve separate visual meanings for schedule, deadline, priority, project and completion.
- **Do** keep mobile capture reachable and clear fixed navigation with the shared safe-area spacing.
- **Do** use quiet surface layering before adding shadows, and honor reduced motion.

### Don't:
- **Don't** introduce raw component colors that bypass appearance and semantic state tokens.
- **Don't** letter-space Hebrew or allow mixed dates, times and shortcuts to reorder punctuation.
- **Don't** turn Today planning data into a productivity score or place it ahead of mobile tasks.
- **Don't** reuse urgency styling as a decorative accent or infer project identity from the action hue.
- **Don't** make hovering or dragging the only way to reach a task action.
