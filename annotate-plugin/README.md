# Live UI Annotate

⚠️ Alpha, testing this while I build

Draw your feedback right on top of your running app and send it straight to Claude.
Instead of describing a change in words, circle it and scribble "make this bigger",
hit Send, and Claude makes the change.

See the [project README](../README.md) for the full guide and FAQ.

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
2. Type `/annotate` to get the drawing toolbar.
3. Draw your feedback and hit **Send**. A toast confirms what Claude changed.

Say "stop reviewing" when you are done.
