# claude-annotate

A Claude Code marketplace hosting **Live UI Annotate** — a plugin to draw on a
live frontend in the Playwright browser and feed the annotated screenshot straight
back into your Claude Code session. Fully local: no cloud, no upload, no Chrome
extension.

## Install

```bash
claude plugin marketplace add tomreinert/claude-annotate
claude plugin install annotate@tom-tools --scope user
```

Then restart Claude Code so the plugin's hooks load.

**Requirements:** the Playwright MCP server connected in Claude Code, and a
localhost dev server for the UI you want to annotate.

## Use

In any project, just say it in natural language:

- "lass uns die UI reviewen" / "I want to annotate this" → review mode on, Claude
  opens the page and shows the drawing toolbar.
- Draw your feedback, then click a review button in the overlay:
  **✓ fertig** (process my notes), **▶ weiter** (no notes, keep going),
  **■ Review aus** (leave review mode).
- Claude captures the annotated viewport, sees it, and incorporates your notes,
  then presents the next round automatically.

You never type a command or "done" — everything is controlled from the overlay.
To bring the panel back after **■ Review aus**, just ask again ("review an").

## What's in here

```
.claude-plugin/marketplace.json   the marketplace manifest (this is the entry point)
annotate-plugin/                  the plugin itself
  ├── .claude-plugin/plugin.json
  ├── hooks/hooks.json            Stop · PostToolUse · SessionStart
  ├── scripts/                    hook logic
  ├── skills/annotate/SKILL.md    the annotation-round procedure
  └── assets/overlay.js           the injectable drawing overlay
```

See [`annotate-plugin/README.md`](annotate-plugin/README.md) for how it works
under the hood.
