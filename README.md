# Live UI Annotate

A Claude Code plugin to give visual feedback to claude via playwright.

Instead of describing the changes, draw and annotate on the site and send it back to to Claude.

<img width="1728" height="1084" alt="screenshot 2026-06-27 um 10 16 57" src="https://github.com/user-attachments/assets/a1ee4ce6-708e-490f-a207-4a641360599f" />


## Install

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```

Then restart Claude Code. You need the [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) installed.

## Use

1. Let Claude open your localhost site in playwright
2. Call `/annotate` and you will get tools to draw on your site.
3. Send your feedback right back into the Claude Session

Note: Claude will stop and wait when you annotate, to continue the session either send your feedback or just escape in the claude session to abort the wait for feedback.
