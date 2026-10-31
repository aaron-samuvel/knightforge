# Production Readiness — Render + PostgreSQL checklist

This is the exact, ordered checklist for taking KnightForge from "works locally"
to "works in production" on Render. Everything the app cannot do for itself is
marked **[YOU]** — those steps need your accounts/credentials.

---

## 0. What the app actually requires (determined from the code)

| Variable | Required? | Used by |
|---|---|---|
| `DATABASE_URL` | ✅ required | Prisma (all persistence) |
| `AUTH_SECRET` | ✅ required in production | session JWT signing (`src/lib/auth.ts`); the server **warns loudly and refuses nothing** if it falls back to the dev secret — do not run prod without it |
| `NEXT_PUBLIC_SITE_NAME` | optional | UI branding (default "KnightForge") |
| `NEXT_PUBLIC_GAME_SERVER` | optional | only for the two-service Render topology (see `docs/deployment.md`); the single-service blueprint leaves it empty |
| `RESEND_API_KEY` + `MAIL_FROM` | optional | password-reset email delivery; without them the reset token is printed to the server console (still functional, just not emailed) |
| `AUTH_EXPOSE_RESET_TOKEN` | ❌ never in prod | dev-only helper that returns reset tokens in API responses |
| **Redis / REDIS_URL** | ❌ **not required** | The app has **no Redis dependency**. Rate limiting is in-memory per instance (`src/lib/rate-limit.ts`) and the matchmaking queue is in the socket server process. Add Redis only if you later run multiple replicas — swap documented in `rate-limit.ts`. |

## 1. GitHub security **[YOU]**

A fine-grained PAT with `Contents: read/write` is embedded in this machine's git
remote (`https://<token>@github.com/aaron-samuvel/knightforge.git`). It is
**not** in the repository, its history, or any tracked file (verified by scan).
Still: it sits in the URL, so treat it as exposed-at-rest.

1. Open <https://github.com/settings/tokens> (and
   <https://github.com/settings/personal-access-tokens> for fine-grained ones).
2. Identify the token created for this workspace and **Revoke** it.
3. Generate a replacement. Scopes: `Contents: read & write` **plus**
   `Workflows: read & write` — the workflow scope is required because the repo
   has a local commit (`.github/workflows/ci.yml` vitest step) that GitHub
   refuses to accept from a token without it.
4. Give the new token to this workspace through its secret mechanism (env var /
   credential vault — **never** paste it into chat, files, or git).

This machine's remote URL will be updated only by you (or by re-running the
platform's credential setup); we deliberately do not hardcode any token.

## 2. PostgreSQL **[YOU — provisioning] / [AUTO — schema work]**

The Prisma schema is Postgres-compatible (no SQLite-only types). Migration:

```bash
# 1. Provision (pick one):
#    Render Dashboard → New → PostgreSQL (free tier available; note the
#    Internal Connection String for Render-hosted apps)
#    or Supabase / Neon → copy the pooled connection string

# 2. In prisma/schema.prisma:
#      provider = "sqlite"  →  provider = "postgresql"

# 3. Create the schema (safe on an empty database):
DATABASE_URL="postgresql://..." bunx prisma db push
#    — or, for reviewable versioned SQL (recommended for prod):
DATABASE_URL="postgresql://..." bunx prisma migrate dev --name init

# 4. Seed demo content (optional):
DATABASE_URL="postgresql://..." bun prisma/seed.ts

# 5. Verify:
DATABASE_URL="postgresql://..." bunx prisma db pull   # round-trips the schema
```

**Data preservation:** `prisma migrate dev` never drops data without asking;
`db push --accept-data-loss` (the package.json script) is for throwaway DBs
only — do not point it at production. Existing production SQLite data can be
migrated with a small export/import script if you have any (ask and it will be
provided); a fresh deployment starts empty and seeds via `seed.ts`.

## 3. Render environment variables **[YOU]**

For the blueprint service `knightforge-web` (Render Dashboard → Environment):

| Key | Value |
|---|---|
| `DATABASE_URL` | the Postgres connection string (Internal URL when the DB is on Render) |
| `AUTH_SECRET` | `openssl rand -hex 32` — paste the output; never commit it |
| `NEXT_PUBLIC_SITE_NAME` | `KnightForge` |
| `RESEND_API_KEY` / `MAIL_FROM` | optional, enables reset emails |
| `AUTH_EXPOSE_RESET_TOKEN` | **delete this key if present** |

Also update `render.yaml`'s `DATABASE_URL` (currently the SQLite volume line) or
remove it and set the var through the dashboard. `AUTH_SECRET: generateValue:
true` in the blueprint already generates a secret automatically.

## 4. Deploy & verify

1. Push the repo → Render auto-deploys (`autoDeployTrigger: commit`).
2. Health: `https://<your-render-url>/api/health` → `{"ok":true}`.
3. Register a fresh account; confirm the session cookie is `Secure`/`httpOnly`.
4. Two browsers → play one rated Quick Match; confirm the Leaderboard updates.
5. Run a Pro Review; confirm "saved to this game's record" and that it reopens
   from Dashboard → Saved Pro Reviews.
6. Check the Render logs for `Persisted game <id>` and no Prisma errors.

Free-tier caveats (unchanged, honest): the free plan **sleeps after ~15 min
idle** (~30–60 s cold start) and the blueprint's SQLite volume resets on each
deploy — step 2 (Postgres) is what makes data durable.

## 5. Troubleshooting

See `docs/troubleshooting.md` for the error → cause → fix table.
