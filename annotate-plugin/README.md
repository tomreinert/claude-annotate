# Claude Annotate

⚠️ Alpha, testing this while I build

A Claude Code plugin to give visual feedback to Claude via Playwright.

This is useful when you look at Claude's work in a browser and want to give feedback. Instead of describing the changes, draw and annotate on the site and send it to Claude.

## How it works

The drawing toolbar is injected onto your page in the Playwright browser. When you hit **Send**, the overlay posts to a local **channel** server (an MCP server that pushes events into your running Claude Code session). Claude wakes up, screenshots your annotations, reads them, incorporates the feedback, and sends a short confirmation toast back onto the page. Because it is a channel, Send lands whether or not Claude is mid-turn. Everything is local.

## Requirements

- Claude Code v2.1.80 or later (channels are a [research preview](https://code.claude.com/docs/en/channels))
- Node.js (runs the channel server; no Bun needed)
- The Playwright MCP connected
- Anthropic auth via claude.ai or a Console API key

## Install

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```

## Use

Launch Claude Code with the channel enabled. Custom channels are not on Anthropic's allowlist yet, so use the development flag:

```bash
claude --dangerously-load-development-channels plugin:annotate@tom-tools
```

1. Let Claude open your localhost site in Playwright.
2. Call `/annotate` and you will get tools to draw on your site.
3. Draw your feedback and hit **Send**. It flows right into the session; a toast confirms what Claude changed.

Say "stop reviewing" when you are done. If Send reports it can't reach the channel, the session was started without the flag above.
