#!/usr/bin/env bash
# SessionStart: if annotation mode is on for this project, tell Claude how to run it.
set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
PLUGIN="${CLAUDE_PLUGIN_ROOT:-}"
cat >/dev/null
mode="off"; [ -f "$ROOT/.claude/annotate.mode" ] && mode="$(tr -d '[:space:]' < "$ROOT/.claude/annotate.mode" || true)"
[ "$mode" = "on" ] || exit 0
OVERLAY="$PLUGIN/assets/overlay.js"
reason="Live UI Annotate is ON for this project (see the annotate skill). Overlay file: ${OVERLAY}. Mode file: ${ROOT}/.claude/annotate.mode. The toolbar is a persistent, draggable surface; register it once via browser_run_code_unsafe + page.context().addInitScript({ path: overlay }) so it auto-loads on every page reload. After each frontend change, present the page: arm(), await window.__annot.waitNext(); on send hide the bar, screenshot to .playwright-mcp/, arm() again, Read, incorporate. The user minimizes to a launcher pill and reopens it themselves; disable() + write off to end review."
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$reason"
