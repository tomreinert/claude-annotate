#!/usr/bin/env bash
# SessionStart: report whether annotation mode is on for this project.
set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
cat >/dev/null
mode="off"; [ -f "$ROOT/.claude/annotate.mode" ] && mode="$(tr -d '[:space:]' < "$ROOT/.claude/annotate.mode" || true)"
[ "$mode" = "on" ] || exit 0   # stay quiet when off, no noise in projects that don't use it
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Live UI Annotate is ON for this project (see the annotate skill). The toolbar is a persistent surface. After any frontend change, present the page: open/refresh it in Playwright, inject the overlay, await window.__annot.waitNext(), then act on the outcome (send=hide bar, capture, arm, Read, incorporate; close=write off to .claude/annotate.mode and stop). The user ends review by clicking Close; you mirror it to the mode file."}}\n'
