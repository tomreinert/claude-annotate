# Live UI Annotate

A Claude Code plugin to give visual feedback to Claude by drawing right on your
live site in the browser.

You're reviewing a page Claude built, you spot things to change, so you draw on it —
arrows, boxes, notes — and send it straight back into your Claude session. Claude
sees exactly what you marked up and fixes it. No describing pixels in words.

<!-- Drop your screen recording here, e.g.: ![demo](demo.gif) -->
_Demo: a Claude session and the browser side by side — calling annotate, drawing
feedback, sending it, and Claude correcting the page._

## Install

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```

Then restart Claude Code. You'll also need the Playwright MCP server connected and
a localhost dev server running for the site you want to annotate.

## Use

1. Let Claude open your localhost site in Playwright.
2. Call **`/annotate`** — a toolbar appears on your site with tools to draw
   (pen, arrows, rectangles, sticky notes).
3. Draw your feedback and hit **Send** — it goes right back into the Claude session.

Claude works on it, shows you the updated page, and you can keep going: draw, send,
repeat. Minimize the toolbar to a small ✏ pill anytime, and click it to reopen.

> **Note:** When you annotate, Claude stops and waits for you. To continue, either
> **Send** your feedback, or press **Escape** in the Claude session to abort the
> wait.
