#!/usr/bin/env bash
# Build and run KnightForge for production (standalone output, port 3000).
# The realtime socket server (port 3003) starts automatically inside the
# same process via src/instrumentation.ts.
set -euo pipefail
cd "$(dirname "$0")/.."

bun run db:push
bun run build
exec bun run start
