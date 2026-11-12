import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from "node:crypto";

// scrypt with the parameters recommended for interactive logins. The stored form carries them, so
// they can be raised later without locking anyone out.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

export const MIN_PASSWORD_LENGTH = 10;

function derive(
  password: BinaryLike,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: 128 * n * r * 2 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Returns "scrypt$N$r$p$salt$hash" (salt and hash in hex). */
export async function hashPassword(
  password: string,
  salt: Buffer = randomBytes(16),
): Promise<string> {
  const hash = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Constant time check. Anything malformed is simply a wrong password, never an exception. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await derive(
      password,
      Buffer.from(saltHex, "hex"),
      Number(n),
      Number(r),
      Number(p),
    );
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
