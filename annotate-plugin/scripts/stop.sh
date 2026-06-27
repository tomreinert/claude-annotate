#!/usr/bin/env bash
# Stop hook: when annotation mode is ON and the frontend changed this turn,
# force one annotation round instead of ending the turn.
set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
MODE_FILE="$ROOT/.claude/annotate.mode"
DIRTY="$ROOT/.claude/annotate.dirty"
cat >/dev/null  # drain hook input JSON

mode="off"; [ -f "$MODE_FILE" ] && mode="$(tr -d '[:space:]' < "$MODE_FILE" || true)"
[ "$mode" = "on" ] || exit 0     # mode off -> end turn normally
[ -f "$DIRTY" ] || exit 0        # no frontend change since last round -> end turn
rm -f "$DIRTY"                   # consume: loop continues only while edits keep happening

cat <<'JSON'
{"decision":"block","reason":"ANNOTATION MODE is ON and frontend code changed this turn. Do not stop — present the page for annotation now, per the 'annotate' skill: (1) ensure the changed page is open and refreshed in the Playwright MCP browser; (2) check `() => !!window.__annot` — if false (page (re)loaded or toolbar closed), inject the overlay by reading the ENTIRE contents of ${CLAUDE_PLUGIN_ROOT}/assets/overlay.js and passing it verbatim as the browser_evaluate `function` arg (runs via CDP, bypasses page CSP); if true, call `() => window.__annot.arm()`; (3) call browser_evaluate with `() => window.__annot.waitNext()` and AWAIT it — it blocks until the user clicks a button and returns: \"send\" (process drawings), \"close\" (toolbar closed), or \"rearm\" (timeout — call it again); (4) on \"send\": hide the bar with `() => window.__annot.setBar(false)`, screenshot the viewport to .playwright-mcp/, then `() => window.__annot.arm()`, Read the PNG, and incorporate the annotations; on \"close\": write 'off' to $CLAUDE_PROJECT_DIR/.claude/annotate.mode and stop presenting. If there is genuinely nothing left to change, say so and you may stop."}
JSON
