---
name: annotate
description: Run one live-UI annotation round — let the user draw on the page open in the Playwright MCP browser and feed the annotated screenshot back. Use when presenting a frontend change for visual feedback, when the user says they want to annotate/markup the UI, or when the Stop hook asks for an annotation round.
---

# Live UI Annotate — one round

Let the user draw directly on the live page in the Playwright MCP browser, then
capture the annotated viewport and read it back. The user draws and clicks the
green **✓ done** button; they never type "done". Everything is local.

## Procedure

1. **Page ready.** Make sure the page you want feedback on is open and refreshed
   in the Playwright browser (`browser_navigate` / reload as needed).

2. **Inject (or re-arm) the overlay.**
   - First check: `browser_evaluate` → `() => !!window.__annot`.
   - If **false** (page was freshly (re)loaded): read the entire contents of
     `${CLAUDE_PLUGIN_ROOT}/assets/overlay.js` and pass it **verbatim** as the
     `function` argument to `browser_evaluate`. It is a single bare arrow
     function. This injects via CDP and **bypasses the page's CSP**, so it works
     on any localhost app regardless of framework or CSP.
   - If **true**: just call `() => window.__annot.arm()` to start a clean round
     (clears the previous round's drawings, resets the done flag). This avoids
     re-sending the overlay every round.

3. **Block for the user.** Call `browser_evaluate` → `() => window.__annot.waitDone()`
   and **await** it. It hangs until the user clicks one of the three review
   buttons, then returns that outcome string:
   - `"done"` — the user drew notes and wants them processed. Go to step 4.
   - `"skip"` — no notes this time; keep reviewing. Continue working; present
     again at the next change.
   - `"stop"` — the user is leaving review mode. **Mirror it:** write `off` to
     `$CLAUDE_PROJECT_DIR/.claude/annotate.mode` and stop presenting.
   - `"rearm"` — a ~4 min self-timeout safety cap. Just call `waitDone()` again;
     the click is never lost (the outcome is sticky).

   The overlay hides its own toolbar on any of these, so it never appears in a capture.

4. **Capture + see** (only for `"done"`). `browser_take_screenshot` (png, viewport,
   NOT fullPage — annotations are fixed to the viewport) to an allowed path such as
   `.playwright-mcp/annot.png`, then `Read` that PNG so you can see the drawings.
   Optionally move it out of the repo afterward.

5. **Incorporate.** Apply the user's annotations (arrows, boxes, freehand, text
   notes like "button bigger", "move dropdown here") to the code.

## The overlay toolbar

Arrow ↗, Box ▭, Freehand ✎, Text T, color swatches, Undo ⤺, Clear, and the three
review buttons: **▶ skip** (skip), **■ stop** (stop), **✓ done** (done, green).
`window.__annot` exposes `arm()`, `finish(outcome)`, `outcome`, `count()`, and
`waitDone(capMs)`.

## Turning review mode on/off — the user never types a command

- **On:** when the user asks to review/annotate the UI (e.g. "let's review this",
  "I want to annotate this"), write `on` to
  `$CLAUDE_PROJECT_DIR/.claude/annotate.mode` (`mkdir -p` the dir first), then run
  a round on the current page.
- **From then on it is browser-driven:** you mirror the user's button choice into
  the mode file — `"stop"` ⇒ write `off`; `"done"`/`"skip"` ⇒ leave it `on`. The
  user controls everything from the overlay; they do not touch the file or type
  commands.
- **Enforcement:** while the mode file says `on`, the bundled `Stop` hook blocks
  you from ending a turn after a frontend change without running a round — so the
  loop is guaranteed, not just remembered.
