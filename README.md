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

- "let's review the UI" / "I want to annotate this" → review mode on, Claude
  opens the page and shows a persistent drawing toolbar at the bottom.
- Draw your feedback, then click **✓ Send**. The toolbar stays up.
- Claude captures the annotated viewport, sees it, and incorporates your notes,
  then presents the updated page so you can draw again.
- Click **✕ Close** to put the toolbar away; say "annotate" to reopen it.

You never type a command or "done" — everything is controlled from the overlay.

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
