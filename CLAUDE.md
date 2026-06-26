# claude-annotation

A local, no-cloud tool to annotate live frontend UIs in the browser and feed the
annotated screenshot straight back into the Claude Code session. Everything runs
locally via the Playwright MCP browser + Claude Code hooks. No extension, no upload.

`test-app/` is a Next.js dev app for testing the loop (dev server on :3000).

## The annotation loop

When **annotation mode is ON**, the workflow is fixed and enforced by hooks — you
do not need to call any command:

1. You change frontend code.
2. The `PostToolUse` hook touches `annotate/.dirty`.
3. When you try to end the turn, the `Stop` hook sees mode ON + dirty and blocks
   you, instructing you to run **one annotation round**:
   - Make sure the changed page is open/refreshed in the Playwright MCP browser.
   - Inject the overlay: call `browser_evaluate` with the **entire verbatim
     contents of `annotate/overlay.js`** as the `function` argument. It is a bare
     arrow function; re-injecting just re-arms a fresh round (clears old drawings,
     resets the done flag).
   - Block for the user: call `browser_evaluate` with `() => window.__annot.waitDone()`
     and await it. This hangs until the user clicks the green **✓ fertig** button.
     If it returns the string `"rearm"` (a self-timeout safety cap), call it again —
     the click is never lost because `done` is sticky.
   - Capture: `browser_take_screenshot` (viewport, png) into the scratchpad dir,
     then `Read` the PNG so you can see the annotations. `fertig` already hid the
     toolbar; the overlay also hides itself on finish, so the bar is never in the shot.
   - Incorporate the annotations into the code.
4. Your new edits set `.dirty` again → next round. A turn with no frontend edits
   ends normally. The loop ends when there is nothing left to change or mode is OFF.

The user draws; you never draw. The user's **✓ fertig** click is the only signal —
the user does not type "done".

## Toggle

- State file: `annotate/.mode` contains `on` or `off`.
- Turn on:  `printf 'on\n'  > annotate/.mode`
- Turn off: `printf 'off\n' > annotate/.mode`
- The `SessionStart` hook reports the current mode into context at startup.
- When the user says "annotate an/aus" (or on/off), flip this file.

## Capture target & storage (current defaults)

- **Viewport only** (not fullPage): annotations are fixed to the viewport, so a
  fullPage shot would misalign them on long pages.
- PNGs go to the **session scratchpad** (temporary, no git footprint), not into
  the repo. Each round overwrites or timestamps as needed.

## Files

- `annotate/overlay.js` — the injectable drawing overlay (toolbar: arrow, box,
  freehand, text; colors; undo; clear; ✓ fertig). Bare arrow function: pass its
  contents verbatim to `browser_evaluate`. Exposes `window.__annot` with
  `arm()`, `finish()`, `count()`, `done`, and `waitDone(capMs)`.
- `.claude/settings.json` — registers the PostToolUse / Stop / SessionStart hooks.
- `.claude/hooks/annotate-stop.sh` — the enforcement logic.
- `.claude/hooks/annotate-mode-context.sh` — reports mode at SessionStart.
