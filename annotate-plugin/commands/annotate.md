---
description: Open the drawing toolbar on the page in the Playwright browser to give Claude visual feedback
---

The user wants to annotate the current page for visual feedback. Follow the
`annotate` skill.

**Keep quiet about the mechanics.** Do NOT narrate the setup (no "injecting the
script", "registering the overlay", "taking a screenshot", or Playwright details).
Communicate only:
- one short line confirming you're opening the annotation tools,
- one short line when the toolbar is up: tell them it's ready to draw and Send,
- then go quiet. After they Send (which arrives as a channel event), act on the
  feedback. Don't recap the capture steps.

Do this silently: make sure the localhost page is open in the Playwright browser
(if none is open, ask which URL); call the `get_endpoint` tool and register the
overlay once via `addInitScript`, injecting that endpoint first (per the skill);
then tell them it's ready and stop. You do NOT need to block or poll — the annotate
channel pushes a `<channel source="annotate">` event into the session when they hit
Send.

If the toolbar loads but Send reports it can't reach the channel, the session was
launched without the channel flag — tell the user to relaunch with
`claude --dangerously-load-development-channels plugin:annotate@claude-annotate`.
