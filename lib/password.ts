import { createHash } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/lib/constants";

/**
 * bcrypt only mixes in the first 72 bytes. Hashing a SHA-256 digest first
 * keeps the full password in the stored hash. Clients still send the raw password.
 */
function prehash(password: string) {
  return createHash("sha256").update(password, "utf8").digest("base64");
}

export function hashPassword(password: string) {
  return hash(prehash(password), BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(prehash(password), passwordHash);
}
