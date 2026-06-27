# Live UI Annotate

A Claude Code plugin to annotate live frontend UIs and feed the marked-up
screenshot straight back into your session. Fully local — uses the Playwright
MCP browser, no cloud, no upload, no Chrome extension.

## What it does

1. You ask Claude to review/annotate the UI ("let's review this"). That turns
   on review mode for this project.
2. Claude changes frontend code and opens the page in the Playwright browser.
3. A persistent drawing toolbar (arrow, box, freehand, text, colors) sits at the
   bottom of the live page.
4. You draw your feedback and click **✓ Send**. The toolbar stays up.
5. Claude captures the annotated viewport, sees it, and incorporates your notes,
   then presents the updated page so you can draw again.
6. Repeat as long as you like. Click **✕ Close** to put the toolbar away; say
   "annotate" to bring it back.

Everything is controlled from the overlay in the browser — you never type a
command or "done". Claude mirrors Close into a per-project state file so a `Stop`
hook can guarantee the loop, but you never touch that file.

## Requirements

- The Playwright MCP server connected in Claude Code (the plugin injects its
  overlay through `browser_evaluate`).
- A localhost dev server for the UI you want to annotate.

## Install

**Local (development):**
```bash
claude --plugin-dir /path/to/annotate-plugin
```

**Via marketplace (from a git repo containing this folder + marketplace.json):**
```bash
claude plugin marketplace add <you>/<repo>
claude plugin install annotate@<marketplace-name> --scope user
```

## Use

Just say it in natural language:

- "let's review this" / "I want to annotate this" → review mode on, toolbar appears
- draw, then click **✓ Send** to hand it over; the toolbar stays for the next pass
- click **✕ Close** to put the toolbar away; say "annotate" to reopen it

When on, just ask Claude to make a frontend change — it presents the page for
annotation after the change, waits for your drawing, and continues.

## How it works

- `assets/overlay.js` — a self-contained drawing overlay (bare arrow function).
  Injected via `browser_evaluate`, which runs through CDP and bypasses page CSP,
  so it works on any localhost app. Exposes `window.__annot.waitNext()`, a promise
  that resolves on Send/Close — that single blocking call is how Claude waits for
  you hands-free.
- `hooks/hooks.json` — `PostToolUse` flags frontend edits, `Stop` enforces a round
  while mode is on and edits keep happening, `SessionStart` reports the mode.
- `skills/annotate/SKILL.md` — the round procedure.
- Per-project state lives in `<project>/.claude/annotate.mode`.
