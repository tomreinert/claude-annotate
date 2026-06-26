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
{"decision":"block","reason":"ANNOTATION MODE is ON and frontend code changed this turn. Do not stop — run exactly one annotation round now, per the 'annotate' skill: (1) ensure the changed page is open and refreshed in the Playwright MCP browser; (2) check `() => !!window.__annot` — if false (page was (re)loaded), inject the overlay by reading the ENTIRE contents of ${CLAUDE_PLUGIN_ROOT}/assets/overlay.js and passing it verbatim as the browser_evaluate `function` arg (runs via CDP, bypasses page CSP); if true, just call `() => window.__annot.arm()`; (3) call browser_evaluate with `() => window.__annot.waitDone()` and AWAIT it — it blocks until the user clicks a review button and returns one of: \"done\" (drew notes), \"skip\" (none, keep reviewing), \"stop\" (leave review mode), or \"rearm\" (timeout — call it again); (4) on \"done\": screenshot the viewport to .playwright-mcp/ and Read the PNG, then incorporate the annotations; on \"skip\": just continue; on \"stop\": write 'off' to $CLAUDE_PROJECT_DIR/.claude/annotate.mode and stop presenting. If there is genuinely nothing left to change, say so and you may stop."}
JSON
