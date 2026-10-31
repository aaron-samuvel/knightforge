import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { hashPassword, isLegacyHash, verifyPassword } from '@/lib/password'

describe('Argon2id password hashing', () => {
  it('produces a PHC argon2id hash with OWASP parameters', async () => {
    const h = await hashPassword('correct horse battery staple')
    expect(h.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true)
  })

  it('verifies the right password and rejects a wrong one', async () => {
    const h = await hashPassword('s3cret-pass')
    expect((await verifyPassword('s3cret-pass', h)).valid).toBe(true)
    expect((await verifyPassword('wrong-pass', h)).valid).toBe(false)
  })

  it('salts — two hashes of the same password differ', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
    expect((await verifyPassword('same-password', b)).valid).toBe(true)
  })

  it('legacy bcrypt hashes verify and request a rehash', async () => {
    const legacy = await bcrypt.hash('old-bcrypt-pass', 10)
    expect(isLegacyHash(legacy)).toBe(true)
    const ok = await verifyPassword('old-bcrypt-pass', legacy)
    expect(ok.valid).toBe(true)
    expect(ok.needsRehash).toBe(true)
    const bad = await verifyPassword('not-the-pass', legacy)
    expect(bad.valid).toBe(false)
    expect(bad.needsRehash).toBe(false)
  })

  it('argon2 hashes never request a rehash; garbage fails closed', async () => {
    const h = await hashPassword('x')
    expect((await verifyPassword('x', h)).needsRehash).toBe(false)
    expect(isLegacyHash(h)).toBe(false)
    expect((await verifyPassword('x', 'not-a-hash')).valid).toBe(false)
  })
})
