---
name: annotate
description: Live-UI annotation — a persistent, draggable toolbar on the page in the Playwright MCP browser lets the user draw; on Send the annotated screenshot flows back to you through the annotate *channel* (an MCP server that pushes the event into the session). Use when presenting a frontend change for visual feedback, when the user wants to annotate/markup/"review" the UI, or when an annotate channel event arrives.
---

# Live UI Annotate

A persistent annotation toolbar sits on the live page. The user draws and clicks
**Send**; the overlay POSTs to the local **annotate channel** server, which pushes
a `<channel source="annotate">` event into this session — so the feedback reaches
you whether or not you're mid-turn. You capture and incorporate; the toolbar stays.
They can **minimize** it to a launcher pill (✏, bottom-right) and reopen anytime.
Everything is local.

## Requirements (the channel must be running)

The channel only delivers if the session was launched with the channel flag.
Custom channels aren't on Anthropic's allowlist yet, so it's:

```
claude --dangerously-load-development-channels plugin:annotate@tom-tools
```

If `window.__annot` injects fine but Send shows "Can't reach the annotate
channel", the session was started without that flag — tell the user to relaunch
with it. (Check the channel is registered with `/mcp` or `/context`.)

## Keep quiet about the mechanics

Do NOT narrate setup or capture steps — no "injecting the script", "registering
the overlay", "hiding the toolbar", "taking a screenshot", or Playwright chatter.
The user only wants:
- a one-line confirmation when you start,
- a one-line "ready — draw your feedback and hit Send" once the toolbar is up,
- then silence until they Send.

## Starting a review ("annotate", "let's review")

1. Make sure the page is open in the Playwright MCP browser (if none, ask which URL).
2. Call the annotate **`get_endpoint` tool**. It returns JSON `{ "url": "...", "token": "..." }`
   for THIS session (each session runs its server on its own ephemeral port with its
   own secret token).
3. Register the overlay **once per session** so it re-runs on every page load. Inject
   the endpoint + token globals FIRST (so they're set before the overlay runs), then
   the overlay, via `browser_run_code_unsafe` — pass `url` and `token` from step 2:

   ```js
   async (page) => {
     await page.context().addInitScript(`window.__ANNOT_ENDPOINT=${JSON.stringify('<URL>')};window.__ANNOT_TOKEN=${JSON.stringify('<TOKEN>')};`);
     await page.context().addInitScript({ path: '<OVERLAY_PATH>' });
     await page.reload({ waitUntil: 'load' });          // apply to the current page too
     return await page.evaluate(() => !!window.__annot); // expect true
   }
   ```

   `<URL>` and `<TOKEN>` are from `get_endpoint`. Without them the toolbar can't reach
   this session (Send returns 403) and will fail.

   `<OVERLAY_PATH>` is `${CLAUDE_PLUGIN_ROOT}/assets/overlay.js`.
   Re-run this any time `() => !!window.__annot` is false (e.g. the MCP browser was
   restarted — init scripts are per browser context).

   **Fallback** if `browser_run_code_unsafe` is unavailable: per page load, first
   `browser_evaluate` `() => { window.__ANNOT_ENDPOINT = '<URL>'; window.__ANNOT_TOKEN = '<TOKEN>'; }`,
   then `browser_evaluate` the entire contents of `overlay.js` as the `function`
   argument (a self-invoking IIFE; runs via CDP, bypasses page CSP).
4. Tell the user it's ready to draw and hit Send. Then stop — you don't need to
   block or poll. The channel will wake you when they Send.

## Handling a Send (a `<channel source="annotate">` event)

When the event arrives, the user has drawn and pressed Send. Do this, silently:

1. `() => window.__annot.setBar(false)` — hides the toolbar, launcher, and toast.
2. `browser_take_screenshot` — png, **viewport** (NOT fullPage) — to `.playwright-mcp/annot.png`.
3. `() => window.__annot.arm()` — clears the canvas and restores the toolbar for the next round.
4. `Read` the PNG and incorporate the drawn feedback into the code.
5. Call the **annotate `reply` tool** with one short line (e.g. "Moved the CTA below
   the fold") — it shows as a toast on the page so the user knows you're on it.

Then stop. The next Send pushes another event; the loop continues for free.

## Turning review off

- **Off** ("stop reviewing", "I'm done"): `() => window.__annot.disable()` — removes
  the overlay and stops it returning on reload (via an in-page flag).
- **Reopen after off**: clear the flag with
  `() => { try { localStorage.removeItem("__annot_off"); } catch (e) {} }`, then
  re-run the setup in "Starting a review".

## Toolbar

Drag it by the grip dots (default bottom-center). Tools: **Arrow** (A),
**Rectangle** (R; Shift = square), **Pen** (P; smoothed), **Text** (T; sticky
note). Colors, stroke **S/M/L**, **Undo** (Cmd/Ctrl+Z), **Clear**, green **Send**,
and **✕** which minimizes to the launcher pill. `window.__annot` exposes `arm`,
`send`, `setBar`, `disable`, `expand`, `minimize`, `clear`, `toast`, `count`.
