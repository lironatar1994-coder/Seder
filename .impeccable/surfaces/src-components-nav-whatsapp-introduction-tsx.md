---
version: 1
slug: "src-components-nav-whatsapp-introduction-tsx"
primary_target: "src/components/nav/whatsapp-introduction.tsx"
related_targets: ["src/components/settings/whatsapp-preview.tsx", "src/components/settings/whatsapp-form.tsx", "src/app/app/settings/whatsapp/page.tsx", "src/app/app/layout.tsx"]
---

Scope: the authenticated WhatsApp reminder introduction and its settings destination.
Visitor mode: Operate. Audience: account holders who have not saved a phone number
or enabled reminders. Job: understand the message they would receive and choose
whether to configure it. The action is opening WhatsApp settings, then saving a
number and choosing preferences; opening or dismissing the introduction grants no
messaging consent.

Direction: an image-led extension of the incumbent world, with no replacement
identity or approved comp. The shared RTL dialog carries a display heading,
concise explanation, a readable reminder illustration, an accent settings action
and an easy dismissal. Actions stack on phones and sit beside each other where
space permits. The settings action stays at least 44px high. The same illustration
appears first in settings. Offline explanations use secondary ink, a neutral
hairline and the quiet second surface layer, preserving amber for time pressure.

Memorable moment: seeing the actual reminder format before making a choice. The
image demonstrates “תזכורת: להכין את המצגת” and “מתחיל בשעה 15:30.”; surrounding
caption and alternative text identify it as an example. It is synthetic content,
not evidence of a message received by a customer.

Behavior and boundaries: show the introduction once per account, using the saved
seen marker and a local guard. Skip settings and wait while another dialog is open.
Keep capture and reminder preferences separate. Only the administrator sees QR,
reconnect, test and service-health controls; ordinary users see their preferences
and their own logs. Sent, delivered and read remain distinct receipt states.

Raster provenance: `design/assets/whatsapp-reminder-preview.png` contains the exact
generation prompt, also retained in `design/assets/whatsapp-reminder-preview.prompt.txt`.
The shipping `public/images/whatsapp-reminder-preview.webp` is 42,844 bytes; its
prompt sidecar is `public/images/whatsapp-reminder-preview.webp.json`. Both UI uses
visibly label the image as an illustration. Its chat colors remain inside the
demonstration image and do not establish new application tokens.

Review evidence: `.impeccable/review/whatsapp/desktop.png`, `mobile.png`,
`user-320-dark.png`, `settings-desktop.png` and `settings-mobile.png`. Final captures
showed no errors or page overflow; 320 unit and 83 E2E checks passed. The final
reviewer disposition was `ship`, scoped to the offline-notice semantic-color fix
being resolved. It does not certify the whole surface or live WhatsApp delivery.

Unresolved operational boundary: at the 2026-10-04 review, production was
`LOGGED_OUT`. A service-phone QR scan is still required before live delivery can
be verified. Local demonstrations, queued tests and receipt UI are not delivery
proof. Earlier workspace and landing review scopes remain separate.
