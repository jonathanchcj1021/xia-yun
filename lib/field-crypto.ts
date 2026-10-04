import { getCloudflareContext } from "@opennextjs/cloudflare";

const TEXT_PREFIX = "enc:v1:";
const BYTE_MAGIC = [0x58, 0x59, 0x45, 0x31];
const IV_BYTES = 12;

export class FieldCryptoError extends Error {
  constructor() {
    super("ENCRYPTION_UNAVAILABLE");
    this.name = "FieldCryptoError";
  }
}

let cachedKey: CryptoKey | null = null;

async function encryptionKey() {
  if (cachedKey) return cachedKey;
  const raw = await keyMaterial();
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) throw new FieldCryptoError();
  cachedKey = await crypto.subtle.importKey(
    "raw",
    decoded,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return cachedKey;
}

async function keyMaterial() {
  const fromProcess = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (fromProcess) return fromProcess;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const fromBinding = env.DATA_ENCRYPTION_KEY?.trim();
    if (fromBinding) return fromBinding;
  } catch {
    /* local next has no worker binding */
  }
  throw new FieldCryptoError();
}

export async function encryptText(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await encryptionKey(),
      new TextEncoder().encode(plain),
    ),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return TEXT_PREFIX + Buffer.from(packed).toString("base64");
}

export async function decryptText(stored: string) {
  if (!stored.startsWith(TEXT_PREFIX)) return stored;
  const packed = Buffer.from(stored.slice(TEXT_PREFIX.length), "base64");
  if (packed.length < IV_BYTES + 16) throw new FieldCryptoError();
  const iv = packed.subarray(0, IV_BYTES);
  const cipher = packed.subarray(IV_BYTES);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: copyBytes(iv) },
      await encryptionKey(),
      copyBytes(cipher),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new FieldCryptoError();
  }
}

function copyBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export async function encryptBytes(plain: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), copyBytes(plain)),
  );
  const packed = new Uint8Array(BYTE_MAGIC.length + iv.length + cipher.length);
  packed.set(BYTE_MAGIC, 0);
  packed.set(iv, BYTE_MAGIC.length);
  packed.set(cipher, BYTE_MAGIC.length + iv.length);
  return packed;
}

export async function decryptBytes(stored: Uint8Array) {
  if (!hasMagic(stored)) return stored;
  if (stored.length < BYTE_MAGIC.length + IV_BYTES + 16) throw new FieldCryptoError();
  const iv = stored.subarray(BYTE_MAGIC.length, BYTE_MAGIC.length + IV_BYTES);
  const cipher = stored.subarray(BYTE_MAGIC.length + IV_BYTES);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: copyBytes(iv) },
        await encryptionKey(),
        copyBytes(cipher),
      ),
    );
  } catch {
    throw new FieldCryptoError();
  }
}

function hasMagic(bytes: Uint8Array) {
  if (bytes.length < BYTE_MAGIC.length) return false;
  return BYTE_MAGIC.every((value, index) => bytes[index] === value);
}
