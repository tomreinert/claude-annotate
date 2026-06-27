# Live UI Annotate

A Claude Code plugin to give visual feedback to Claude via Playwright.

Instead of describing the changes, draw and annotate on the site and send it back to Claude.

<img width="1728" height="1084" alt="screenshot 2026-06-27 um 10 16 57" src="https://github.com/user-attachments/assets/a1ee4ce6-708e-490f-a207-4a641360599f" />


## How it works

The drawing toolbar is injected onto your page in the Playwright browser. When you hit **Send**, the overlay posts to a local **channel** server (an MCP server that pushes events into your running Claude Code session). Claude wakes up, screenshots your annotations, reads them, and gets to work, then sends a short confirmation toast back onto the page. Because it is a channel, Send lands whether or not Claude is mid-turn. Everything is local.

## Requirements

- Claude Code v2.1.80 or later (channels are a [research preview](https://code.claude.com/docs/en/channels))
- Node.js (used to run the channel server; no Bun needed)
- The [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) connected
- Anthropic auth via claude.ai or a Console API key (channels are not available on Bedrock, Vertex, or Foundry)

## Install

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```

## Use

Start Claude Code with the channel enabled. Custom channels are not on Anthropic's allowlist yet, so launch with the development flag:

```bash
claude --dangerously-load-development-channels plugin:annotate@tom-tools
```

Then:

1. Let Claude open your localhost site in Playwright.
2. Call `/annotate`. The drawing toolbar appears on your page.
3. Draw your feedback and hit **Send**. It flows straight into the session; Claude acts on it and a toast confirms what it changed.

Repeat as often as you like. Say "stop reviewing" when you are done.

If the toolbar shows but Send reports "Can't reach the annotate channel", the session was started without the channel flag above.

## Toolbar

Arrow (A), Rectangle (R, Shift = square), Pen (P), Text (T, sticky note). Colors, stroke S/M/L, Undo (Cmd/Ctrl+Z), Clear, green Send, and ✕ to minimize to a launcher pill (✏) you can reopen anytime.
