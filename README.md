# Live UI Annotate

Draw your feedback right on top of your running app and send it straight to Claude.

<img width="1000" height="545" alt="annotate" src="https://github.com/user-attachments/assets/4baa8df2-e326-4575-9ddd-8ab25e5f36ba" />

## Why

When you are looking at Claude's work in the browser, it is much faster to circle
the thing and scribble "make this bigger" than to describe it in words. This plugin
puts a little drawing toolbar on your live page. You mark up what you want, hit
**Send**, and Claude sees exactly what you meant and makes the change. No more
writing "the button in the top right, no the other one, move it down a bit".

## What you can do

- Draw arrows, boxes, freehand strokes, and sticky notes anywhere on your page.
- Send the marked-up view to Claude with one click. It picks it up and gets to work.
- Keep iterating: draw, send, watch the change, draw again. The toolbar stays put.
- Tuck it away into a small pill when you want it out of the way, and pop it back when you need it.

## Install

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```

You will also need the [Playwright MCP](https://playwright.dev/docs/getting-started-mcp)
connected, since the toolbar lives on the page Claude opens in Playwright.

## Use

Launch Claude Code with the channel turned on:

```bash
claude --dangerously-load-development-channels plugin:annotate@tom-tools
```

Then:

1. Let Claude open your localhost site.
2. Type `/annotate`. The drawing toolbar appears on the page.
3. Draw your feedback and hit **Send**. Claude makes the change and a little toast confirms what it did.

Keep drawing and sending as often as you like. Say "stop reviewing" when you are done.

## Toolbar

Arrow (A), Rectangle (R, Shift = square), Pen (P), Text (T, sticky note). Plus
colors, stroke size S/M/L, Undo (Cmd/Ctrl+Z), Clear, the green Send button, and ✕
to tuck it into the launcher pill (✏) you can reopen anytime.

## FAQ

### Why the scary `--dangerously-load-development-channels` flag? Is it safe?

It is safe, and the flag is less alarming than it sounds.

The plugin uses a Claude Code "channel" to push your annotations into your session.
That is what makes Send land even when Claude is mid-task, and it is the only way for
the browser toolbar to reach your session. During the research preview, Claude Code
only auto-loads channels that are on Anthropic's official allowlist; everything else
needs this flag. This plugin is not on that list, so the flag is simply how you say
"yes, load this one". It does **not** grant the plugin any extra access to your machine.

Everything runs locally and is locked down:

- The little server only listens on your own machine (localhost), on a random port
  per session. Nothing is sent to any cloud service.
- Every request carries a secret token unique to your session, so other websites or
  programs on your machine cannot talk to it even if they find the port.
- It never asks to approve actions for you. Anything Claude does in response still
  goes through Claude Code's normal approval prompts.
- The whole thing is open source, so you (or Claude) can read every line before
  trusting it.

### Can I avoid the flag? Will this ever be on the allowlist?

Two ways the flag goes away:

- **Inside a Team or Enterprise org**, an Owner can allow this plugin in managed
  settings, after which everyone in the org launches with plain `--channels` (no dev
  flag). Add it to `allowedChannelPlugins` (and make sure members have the `tom-tools`
  marketplace added):

  ```json
  {
    "channelsEnabled": true,
    "allowedChannelPlugins": [
      { "marketplace": "tom-tools", "plugin": "annotate" }
    ]
  }
  ```

- **Anthropic's public allowlist** is curated by Anthropic and currently only covers
  the official `claude-plugins-official` channels. There is no self-serve submission
  for it during the research preview, so until that changes, public users need the
  dev flag.

### Does it work with more than one project open at once?

Yes. Each Claude Code session runs its own server on its own port, so annotations
always go to the session you are drawing in.

### The toolbar shows but Send says it can't reach the channel.

The session was started without the channel flag. Relaunch with
`claude --dangerously-load-development-channels plugin:annotate@tom-tools`.

### Why does it need Playwright?

The toolbar is drawn onto the actual page in the browser Claude controls through the
Playwright MCP. That is also how Claude captures what you drew.
