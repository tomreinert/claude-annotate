#!/usr/bin/env bash
# Launches the annotate channel server. Claude Code spawns this over stdio, so
# stdout MUST stay clean (JSON-RPC only) — all install noise is forced to stderr.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d node_modules/@modelcontextprotocol ]; then
  npm install --silent --no-audit --no-fund --no-progress 1>&2
fi
exec node scripts/channel.mjs
