# Live UI Annotate

Draw your feedback right on top of your running app and send it straight to Claude.

<img width="1000" height="545" alt="annotate" src="https://github.com/user-attachments/assets/4baa8df2-e326-4575-9ddd-8ab25e5f36ba" />

Draw your feedback, hit **Send**. Claude sees exactly what
you meant and makes the change. No more "the button in the top right, no the other one".

## Install

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```

You also need the [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) connected.

## Use

Launch Claude Code with the channel turned on:

```bash
claude --dangerously-load-development-channels plugin:annotate@tom-tools
```

1. Let Claude open your localhost site.
2. Type `/annotate`. The drawing toolbar appears on the page.
3. Draw your feedback and hit **Send**. Claude makes the change and a toast confirms it.

Keep drawing and sending as often as you like. Say "stop reviewing" when you are done.

See the [full guide](GUIDE.md) for the toolbar shortcuts and FAQ (including why the
`--dangerously-load-development-channels` flag is safe and how to skip it).
