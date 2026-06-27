---
name: annotate
description: Live-UI annotation — a persistent, draggable toolbar on the page in the Playwright MCP browser lets the user draw; the annotated screenshot flows back to you. The user draws → Send → you work → they draw again → … and minimizes to a launcher pill (✏) to get it out of the way. Use when presenting a frontend change for visual feedback, when the user wants to annotate/markup/"review" the UI, or when the Stop hook asks for an annotation pass.
---

# Live UI Annotate

A persistent annotation toolbar sits on the live page. The user draws and clicks
**Send**; you capture and incorporate; the toolbar stays. They can **minimize** it
to a small launcher pill (✏, bottom-right) and reopen it anytime — no message to
you needed. The user never types "done". Everything is local.

## Keep quiet about the mechanics

Do NOT narrate the setup or capture steps — no "injecting the script",
"registering the overlay", "hiding the toolbar", "taking a screenshot", "calling
arm/waitNext", or Playwright chatter. The user only wants to know:
- a one-line confirmation when you start,
- a one-line "ready — draw your feedback and hit Send" once the toolbar is up,
- then silence while they draw (you're blocked on `waitNext` anyway).

After Send, respond to what they drew (or make the change); don't recap how you
captured it.

## Overlay injection — register ONCE per session via addInitScript

The overlay is registered once so the browser re-runs it on **every** page load
(survives reloads/HMR; not re-sent each time). The bundled file's absolute path is
given to you by the Stop / SessionStart hooks (`…/assets/overlay.js`).

Register with `browser_run_code_unsafe`:

```js
async (page) => {
  await page.context().addInitScript({ path: '<OVERLAY_PATH>' });
  await page.reload({ waitUntil: 'load' });          // apply to the current page too
  return await page.evaluate(() => !!window.__annot); // expect true
}
```

Do this when review starts, or any time `() => !!window.__annot` is false (e.g.
the MCP browser was restarted — init scripts are per browser context).

**Fallback** if `browser_run_code_unsafe` is unavailable: inject per page load with
`browser_evaluate`, passing the entire contents of `overlay.js` as the `function`
argument. It is a self-invoking IIFE and runs as-is, via CDP (bypasses page CSP).
In this mode you must re-inject after every navigation.

## Each annotation pass

1. Make sure the changed page is open/refreshed — the overlay auto-appears.
2. `() => window.__annot.arm()` — clears the canvas, shows the toolbar ready to draw.
3. `await () => window.__annot.waitNext()`. It returns:
   - `"send"` — the user wants the drawings processed → step 4.
   - `"rearm"` — a ~4 min self-timeout; just call `waitNext()` again. **Minimizing
     does NOT resolve it** (the user is still deciding) — keep waiting.
4. On `"send"`: `() => window.__annot.setBar(false)` (hides toolbar + launcher for a
   clean shot) → `browser_take_screenshot` (png, viewport, NOT fullPage) to
   `.playwright-mcp/annot.png` → `() => window.__annot.arm()` (restores the toolbar)
   → `Read` the PNG → incorporate the annotations into the code.
5. After your edits the `Stop` hook presents again, so the loop continues. The
   toolbar persists across the whole session.

## Turning review on/off (the user never types a command)

- **On** ("let's review", "annotate"): write `on` to `<project>/.claude/annotate.mode`
  (the hooks give you the path), ensure the overlay is registered, and present.
- **Off** ("stop reviewing", "I'm done"): `() => window.__annot.disable()` (removes
  the overlay and stops it returning on reload via an in-page flag) and write `off`
  to the mode file.
- **Reopen after off** ("annotate" again): clear the flag with
  `() => { try { localStorage.removeItem("__annot_off"); } catch (e) {} }`, then
  re-run setup and present.

## Toolbar

Drag it by the grip dots (default bottom-center). Tools: **Arrow** (A),
**Rectangle** (R; Shift = square), **Pen** (P; smoothed strokes), **Text** (T;
sticky note — faint yellow, black border/text). Colors, stroke **S/M/L**, **Undo**
(Cmd/Ctrl+Z), **Clear**, green **Send**, and **✕** which minimizes to the launcher
pill. `window.__annot` exposes `arm`, `waitNext`, `setBar`, `finish`, `disable`,
`expand`, `minimize`, `clear`, `count`, `outcome`.
