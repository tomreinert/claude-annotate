# Live UI Annotate

A Claude Code plugin to give visual feedback to Claude by drawing right on your
live site in the browser.

You spot something to change on a page Claude built, so you draw on it — arrows,
boxes, sticky notes — and send it straight back into your Claude session. Claude
sees exactly what you marked and fixes it.

## Install

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```

Then restart Claude Code. Requires the Playwright MCP server connected and a
localhost dev server for the site you want to annotate.

## Use

1. Let Claude open your localhost site in Playwright.
2. Call **`/annotate`** — a toolbar appears with tools to draw (pen, arrows,
   rectangles, sticky notes).
3. Draw your feedback and hit **Send** — it goes right back into the Claude session.

Keep going as long as you like: draw, send, repeat. Minimize the toolbar to a
small ✏ pill anytime, and click it to reopen.

> **Note:** When you annotate, Claude stops and waits. To continue, either **Send**
> your feedback or press **Escape** in the Claude session to abort the wait.
