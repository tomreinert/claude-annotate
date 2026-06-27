---
name: annotate
description: Live-UI annotation — let the user draw on the page open in the Playwright MCP browser and feed the annotated screenshot back. The toolbar is a persistent surface the user drives (draw → Send → you work → draw → … → Close). Use when presenting a frontend change for visual feedback, when the user says they want to annotate/markup the UI or to "review" it, or when the Stop hook asks for an annotation round.
---

# Live UI Annotate

Let the user draw directly on the live page in the Playwright MCP browser, then
capture the annotated viewport and read it back. The toolbar is **persistent** —
it stays up across many cycles. The user drives it: draw → **Send** → you work →
the page updates → draw again → … → **Close**. The user never types "done".
Everything is local.

## Procedure

1. **Page ready.** Make sure the page you want feedback on is open and refreshed
   in the Playwright browser (`browser_navigate` / reload as needed).

2. **Inject (or re-arm) the overlay.**
   - First check: `browser_evaluate` → `() => !!window.__annot`.
   - If **false** (page was freshly (re)loaded, or the user closed the toolbar):
     read the entire contents of `${CLAUDE_PLUGIN_ROOT}/assets/overlay.js` and pass
     it **verbatim** as the `function` argument to `browser_evaluate`. It is a
     single bare arrow function. This injects via CDP and **bypasses the page's
     CSP**, so it works on any localhost app regardless of framework or CSP.
   - If **true**: just call `() => window.__annot.arm()` to ready a fresh drawing
     (clears the canvas, keeps the toolbar up). This avoids re-sending the overlay.

3. **Block for the user.** Call `browser_evaluate` → `() => window.__annot.waitNext()`
   and **await** it. It hangs until the user clicks a button, then returns:
   - `"send"` — the user wants the current drawings processed. Go to step 4.
   - `"close"` — the user closed the toolbar (it removes itself). **Mirror it:**
     write `off` to `$CLAUDE_PROJECT_DIR/.claude/annotate.mode` and stop presenting.
     The user reopens later by saying "annotate".
   - `"rearm"` — a ~4 min self-timeout safety cap. Just call `waitNext()` again;
     the click is never lost (the outcome is sticky).

4. **Capture + see** (for `"send"`). The toolbar stays up, so hide it only for the
   capture frame: `() => window.__annot.setBar(false)`, then `browser_take_screenshot`
   (png, viewport, NOT fullPage — annotations are fixed to the viewport) to an
   allowed path such as `.playwright-mcp/annot.png`, then `() => window.__annot.arm()`
   (shows the bar again and clears the canvas for the next drawing). `Read` the PNG
   so you can see the drawings.

5. **Incorporate.** Apply the user's annotations (arrows, boxes, freehand, text
   notes like "button bigger", "move dropdown here") to the code. After your edits
   the `Stop` hook presents the page again so the user can keep annotating — the
   toolbar persists across the whole session until they Close.

## The overlay toolbar

Arrow ↗, Box ▭, Freehand ✎, Text T, color swatches, Undo ⤺, Clear, and two control
buttons: **✓ Send** (green — hand drawings over, toolbar stays) and **✕ Close**
(remove the toolbar). `window.__annot` exposes `arm()`, `finish(outcome)`,
`setBar(visible)`, `clear()`, `outcome`, `count()`, and `waitNext(capMs)`.

## Turning review mode on/off — the user never types a command

- **On:** when the user asks to review/annotate the UI (e.g. "let's review this",
  "annotate"), write `on` to `$CLAUDE_PROJECT_DIR/.claude/annotate.mode`
  (`mkdir -p` the dir first), then present the current page.
- **Browser-driven after that:** you mirror the user's button choice into the mode
  file — `"close"` ⇒ write `off`; `"send"` ⇒ leave it `on`. The user controls
  everything from the overlay; they never touch the file or type commands.
- **Enforcement:** while the mode file says `on`, the bundled `Stop` hook blocks
  you from ending a turn after a frontend change without presenting — so the loop
  is guaranteed, not just remembered.
