#!/usr/bin/env bash
# KnightForge one-time local setup. Idempotent — safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;32m==>\033[0m \033[1m%s\033[0m\n' "$*"; }

# 1) Bun present?
if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required. Install it with:  curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi
say "Bun $(bun --version) found"

# 2) Dependencies
say "Installing dependencies"
bun install

# 3) Environment file
if [ ! -f .env ]; then
  say "Creating .env from .env.example (random AUTH_SECRET)"
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 32)"
  else
    SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  sed -i.bak "s/^AUTH_SECRET=.*/AUTH_SECRET=${SECRET}/" .env && rm -f .env.bak
else
  say ".env already exists — leaving it untouched"
fi

# 4) Database
say "Generating Prisma client + pushing schema"
bun run db:generate
bun run db:push

# 5) Seed demo data (idempotent)
say "Seeding demo players & games"
bun prisma/seed.ts

say "Done! Start the app with:  make dev   (or: docker compose up -d --build)"
