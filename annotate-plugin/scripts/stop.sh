#!/usr/bin/env bash
# Stop hook: when annotation mode is ON and the frontend changed this turn, force
# an annotation pass instead of ending the turn. The "frontend changed" signal is
# the .dirty flag set by the PostToolUse hook; we consume it so the loop only
# continues while edits keep happening.
set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
PLUGIN="${CLAUDE_PLUGIN_ROOT:-}"
MODE_FILE="$ROOT/.claude/annotate.mode"
DIRTY="$ROOT/.claude/annotate.dirty"
cat >/dev/null  # drain hook input JSON

mode="off"; [ -f "$MODE_FILE" ] && mode="$(tr -d '[:space:]' < "$MODE_FILE" || true)"
[ "$mode" = "on" ] || exit 0
[ -f "$DIRTY" ] || exit 0
rm -f "$DIRTY"

OVERLAY="$PLUGIN/assets/overlay.js"
# Reason text intentionally avoids double-quotes and backticks so it embeds safely
# in the JSON string below. It carries the real absolute paths for this project.
reason="ANNOTATION MODE is ON and frontend code changed this turn. Do not stop — present the page for annotation now, per the annotate skill. Overlay file: ${OVERLAY}. Mode file: ${MODE_FILE}. Setup once per session (or whenever () => !!window.__annot is false): call browser_run_code_unsafe with  async (page) => { await page.context().addInitScript({ path: '${OVERLAY}' }); await page.reload({ waitUntil: 'load' }); return await page.evaluate(() => !!window.__annot); }  so the overlay auto-loads on every page load. Each pass: ensure the changed page is open/refreshed, then () => window.__annot.arm(), then await () => window.__annot.waitNext() which returns send (process drawings) or rearm (timeout, call again); minimize does NOT resolve it, keep waiting. On send: () => window.__annot.setBar(false), screenshot the viewport to .playwright-mcp/, () => window.__annot.arm(), Read the PNG, incorporate. If the user says stop/done: () => window.__annot.disable() and write off to the mode file. If genuinely nothing to change, say so and you may stop."

printf '{"decision":"block","reason":"%s"}\n' "$reason"
