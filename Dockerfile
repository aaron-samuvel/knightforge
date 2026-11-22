# syntax=docker/dockerfile:1
# ---------- Stage 1: dependencies ----------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma needs a DATABASE_URL at generate time; the real one is set at runtime.
ENV DATABASE_URL=file:./db/build.db
RUN bun run db:generate \
  # Pre-generate the DDL so the runtime image never needs the Prisma CLI.
  # Applied on startup by scripts/migrate.ts (bun:sqlite) — see below.
  && bun node_modules/prisma/build/index.js migrate diff \
      --from-empty --to-schema-datamodel prisma/schema.prisma --script \
      > prisma/migration.sql \
  && bun run build

# ---------- Stage 3: runtime ----------
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system knightforge && useradd --system --gid knightforge knightforge

# Next standalone output (server.js + traced node_modules incl. prisma/socket.io)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma schema + generated client + pre-built DDL (migration.sql)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Startup scripts (schema migration) + seed deps
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib/password.ts ./src/lib/password.ts

# SQLite lives here — mount a volume on this path to persist data
RUN mkdir -p /app/db && chown -R knightforge:knightforge /app
USER knightforge

EXPOSE 3000 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "const p=process.env.PORT||3000; const r=await fetch('http://127.0.0.1:'+p+'/api/health'); process.exit(r.ok?0:1)"

# server.js serves the web app; src/instrumentation.ts (compiled into the
# standalone server) also starts the realtime socket server on :3003.
# Apply the DB schema (idempotent, no Prisma CLI needed) then seed demo data
# (idempotent: users upserted, games only when empty), then serve.
CMD ["sh", "-c", "bun scripts/migrate.ts && bun prisma/seed.ts; exec bun server.js"]
