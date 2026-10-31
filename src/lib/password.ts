// KnightForge — password hashing (KNIGHTFORGE ULTIMATE, P19)
//
// Argon2id (OWASP-recommended parameters m=19456 KiB, t=2, p=1) via
// hash-wasm — a pure WebAssembly implementation, so it runs identically on
// Node, Bun, Vercel and Render with zero native binaries.
//
// Migration: accounts created before P19 carry bcrypt hashes. On a successful
// bcrypt login the hash is transparently re-hashed to Argon2id
// (see verifyPassword -> { valid, needsRehash }).

import { argon2id, argon2Verify } from 'hash-wasm'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'

// OWASP minimum recommendations for Argon2id
const ARGON2_MEMORY_KIB = 19456 // 19 MiB
const ARGON2_ITERATIONS = 2
const ARGON2_PARALLELISM = 1
const ARGON2_HASH_LENGTH = 32

/** Hash a password with Argon2id, returning a PHC-format string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  return argon2id({
    password,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: 'encoded',
  })
}

/**
 * Verify a password against a stored hash.
 *
 * Accepts both Argon2id (PHC string) and legacy bcrypt hashes. When a legacy
 * bcrypt hash verifies, `needsRehash` is true so the caller can transparently
 * upgrade the account to Argon2id.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (storedHash.startsWith('argon2id$') || storedHash.startsWith('$argon2')) {
    try {
      return { valid: await argon2Verify({ password, hash: storedHash }), needsRehash: false }
    } catch {
      return { valid: false, needsRehash: false }
    }
  }

  // Legacy bcrypt ($2a$ / $2b$ / $2y$) — verify, then flag for rehash
  if (storedHash.startsWith('$2')) {
    try {
      const valid = await bcrypt.compare(password, storedHash)
      return { valid, needsRehash: valid }
    } catch {
      return { valid: false, needsRehash: false }
    }
  }

  return { valid: false, needsRehash: false }
}

/** True when the stored hash is not yet Argon2id (used for seeding/migration). */
export function isLegacyHash(storedHash: string): boolean {
  return storedHash.startsWith('$2')
}
