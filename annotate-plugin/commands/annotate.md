---
description: Open the drawing toolbar on the page in the Playwright browser to give Claude visual feedback
---

The user wants to annotate the current page for visual feedback. Follow the
`annotate` skill:

1. Make sure the localhost page is open in the Playwright MCP browser. If no page
   is open, ask which URL to open (or open the dev server they mentioned).
2. Turn review mode on for this project:
   `mkdir -p "$CLAUDE_PROJECT_DIR/.claude" && printf 'on\n' > "$CLAUDE_PROJECT_DIR/.claude/annotate.mode"`
3. Register and show the overlay (via `addInitScript`, per the skill), then
   `await () => window.__annot.waitNext()` to wait for the user's drawing.
4. When they click **Send**, capture the annotated viewport, read it, and act on
   the feedback. The toolbar stays up; they minimize/reopen it via the ✏ pill, and
   can press Escape in the Claude session to abort the wait.
