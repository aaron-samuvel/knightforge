// Test environment — runs before any module import so that the Prisma client
// (constructed at import time in src/lib/db.ts) binds to the throwaway test
// database, never the dev/production one.
process.env.DATABASE_URL = 'file:./db/test.db'
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? 'test-only-secret-0123456789abcdef0123456789abcdef'
process.env.AUTH_EXPOSE_RESET_TOKEN = ''
