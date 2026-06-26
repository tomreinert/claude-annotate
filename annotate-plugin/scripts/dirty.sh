#!/usr/bin/env bash
# PostToolUse(Edit|Write): mark that frontend code changed this turn, but only
# when annotation mode is on for this project (no footprint otherwise).
set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
cat >/dev/null
mode="off"; [ -f "$ROOT/.claude/annotate.mode" ] && mode="$(tr -d '[:space:]' < "$ROOT/.claude/annotate.mode" || true)"
[ "$mode" = "on" ] || exit 0
mkdir -p "$ROOT/.claude"
touch "$ROOT/.claude/annotate.dirty"
exit 0
