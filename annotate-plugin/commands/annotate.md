---
description: Open the drawing toolbar on the page in the Playwright browser to give Claude visual feedback
---

The user wants to annotate the current page for visual feedback. Follow the
`annotate` skill.

**Keep quiet about the mechanics.** Do NOT narrate the setup (no "injecting the
script", "registering the overlay", "taking a screenshot", "calling waitNext", or
Playwright details). The user does not care how it works. Communicate only:
- one short line confirming you're opening the annotation tools,
- one short line when the toolbar is up: tell them it's ready to draw and Send,
- then go quiet and wait. After they Send, just act on the feedback. Don't recap
  the capture steps.

Do this silently: make sure the localhost page is open in the Playwright browser
(if none is open, ask which URL); turn review mode on
(`mkdir -p "$CLAUDE_PROJECT_DIR/.claude" && printf 'on\n' > "$CLAUDE_PROJECT_DIR/.claude/annotate.mode"`);
register and show the overlay (`addInitScript`, per the skill); then
`await () => window.__annot.waitNext()`. They minimize/reopen via the ✏ pill and
can press Escape to abort the wait.
