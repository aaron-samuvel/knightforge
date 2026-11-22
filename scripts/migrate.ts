/**
 * Minimal startup migration for containerized deploys.
 *
 * Applies the SQL schema generated at Docker build time
 * (`prisma migrate diff --from-empty ... --script > prisma/migration.sql`)
 * to the runtime SQLite database using Bun's built-in sqlite driver.
 *
 * This avoids shipping the Prisma CLI (and its large dependency tree) in the
 * runtime image. Idempotent: skips when the schema already exists, so
 * restarts and redeploys never touch existing data.
 *
 * Run with: bun scripts/migrate.ts
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const url = process.env.DATABASE_URL ?? "file:./db/custom.db";
const dbPath = resolve(url.replace(/^file:/, ""));

// Relative paths (file:./db/x.db) are relative to the prisma folder for the
// client, but at container startup CWD is /app — create the dir if missing.
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath, { create: true });

const marker = db
  .query<{ c: number }, []>(
    "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = 'User'"
  )
  .get();

if (marker && marker.c > 0) {
  console.log("[migrate] schema already present — skipping");
  process.exit(0);
}

const sql = await Bun.file(resolve("prisma/migration.sql")).text();
db.exec(sql);
console.log("[migrate] schema applied to", dbPath);
