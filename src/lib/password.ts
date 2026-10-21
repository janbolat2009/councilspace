import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const cost = { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 };
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, cost, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16), key = await derive(password, salt);
  return ["scrypt-v1", salt.toString("hex"), key.toString("hex")].join("$");
}
export async function verifyPassword(password: string, encoded: string | null) {
  const parts = encoded?.split("$");
  const valid = parts?.length === 3 && parts[0] === "scrypt-v1" && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  // Unknown accounts perform the same expensive derivation as known accounts.
  const salt = valid ? Buffer.from(parts[1], "hex") : Buffer.alloc(16, 1);
  const expected = valid ? Buffer.from(parts[2], "hex") : Buffer.alloc(64);
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected) && !!valid;
}
