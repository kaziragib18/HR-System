import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// A precomputed hash (same cost factor as real password hashes, but not tied
// to any real account) used purely to burn the same CPU time as a genuine
// bcrypt.compare. login() must not let a "no such user" response come back
// measurably faster than a "wrong password" one — that timing gap is enough
// to let an attacker enumerate which emails have accounts.
const DUMMY_HASH = '$2a$12$NEc1gf7GfnyErIKsJ5aVv./2BiLnYH5S.AEwnlglubPkZ.ZJq4.YS'

export async function compareAgainstDummyHash(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH)
}
