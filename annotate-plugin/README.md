# Claude Code Annotate

⚠️ Alpha, testing this while I build

Draw your feedback right on top of your running app and send it straight to Claude.

See the [README](../README.md) for the full guide and FAQ.

## Install

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```

You also need the [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) connected.

## Use

Launch Claude Code with the channel turned on*:

```bash
claude --dangerously-load-development-channels plugin:annotate@tom-tools
```

1. Type `/annotate` to have Claude launch a Playwright browser with the annotation toolbar.
2. Draw your feedback and hit **Send**.
3. Watch Claude pick up the feedback and make the changes.
4. Profit.

## *Why the dangerous flag? Am I in danger?

The `--dangerously-load-development-channels` flag is needed because the plugin uses
a Claude Code *channel* to push your annotations into the session. During the research
preview Claude Code only auto-loads channels on Anthropic's official allowlist, and
this plugin isn't on it, so the flag is how you opt in to loading it. It grants the
plugin no extra access (see the [FAQ](../README.md#faq) for what it does and doesn't
do, and how to skip the flag inside a Team/Enterprise org).


