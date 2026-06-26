#!/usr/bin/env bash
# SessionStart: report whether annotation mode is on for this project.
set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
cat >/dev/null
mode="off"; [ -f "$ROOT/.claude/annotate.mode" ] && mode="$(tr -d '[:space:]' < "$ROOT/.claude/annotate.mode" || true)"
[ "$mode" = "on" ] || exit 0   # stay quiet when off, no noise in projects that don't use it
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Live UI Annotate is ON for this project (see the annotate skill). After any frontend change, run one annotation round: open/refresh the page in Playwright, inject the overlay, await window.__annot.waitDone(), then act on the outcome (done=capture+incorporate, skip=continue, stop=write off to .claude/annotate.mode). The user ends review mode via the overlay button; you mirror it to the mode file."}}\n'
