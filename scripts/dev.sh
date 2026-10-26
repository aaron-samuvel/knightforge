#!/usr/bin/env bash
# Start KnightForge in development mode (web + realtime in one process).
set -euo pipefail
cd "$(dirname "$0")/.."

bun run db:push
exec bun run dev
