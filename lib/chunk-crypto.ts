import { SINGLE_UPLOAD_BYTES } from "@/lib/constants";
import { decryptBytes, FieldCryptoError } from "@/lib/field-crypto";
import { partPlainLength } from "@/lib/upload-plan";

const MAGIC = [0x58, 0x59, 0x43, 0x31];
const XYE1 = [0x58, 0x59, 0x45, 0x31];
const HEADER_BYTES = 24;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type ChunkHeader = {
  chunkPlainSize: number;
  totalPlainSize: number;
  chunkCount: number;
};

export function encodeChunkHeader(header: ChunkHeader) {
  const bytes = new Uint8Array(HEADER_BYTES);
  bytes.set(MAGIC, 0);
  bytes[4] = 1;
  bytes[5] = 0;
  bytes[6] = IV_BYTES;
  bytes[7] = TAG_BYTES;
  const view = new DataView(bytes.buffer);
  view.setUint32(8, header.chunkPlainSize);
  view.setBigUint64(12, BigInt(header.totalPlainSize));
  view.setUint32(20, header.chunkCount);
  return bytes;
}

export function decodeChunkHeader(bytes: Uint8Array): ChunkHeader | null {
  if (bytes.byteLength < HEADER_BYTES) return null;
  if (!MAGIC.every((value, index) => bytes[index] === value)) return null;
  if (bytes[4] !== 1 || bytes[6] !== IV_BYTES || bytes[7] !== TAG_BYTES) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkPlainSize = view.getUint32(8);
  const totalPlainSize = Number(view.getBigUint64(12));
  const chunkCount = view.getUint32(20);
  if (!Number.isSafeInteger(totalPlainSize) || chunkPlainSize < 1 || chunkCount < 1) return null;
  return { chunkPlainSize, totalPlainSize, chunkCount };
}

function chunkIndex(index: number) {
  const aad = new Uint8Array(4);
  new DataView(aad.buffer).setUint32(0, index);
  return aad;
}

function copyBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export async function encryptChunk(plain: Uint8Array, index: number, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: chunkIndex(index) },
      key,
      copyBytes(plain),
    ),
  );
  const frame = new Uint8Array(iv.byteLength + cipher.byteLength);
  frame.set(iv, 0);
  frame.set(cipher, iv.byteLength);
  return frame;
}

export async function decryptChunk(frame: Uint8Array, index: number, key: CryptoKey) {
  if (frame.byteLength < IV_BYTES + TAG_BYTES) throw new FieldCryptoError();
  const iv = frame.subarray(0, IV_BYTES);
  const cipher = frame.subarray(IV_BYTES);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: copyBytes(iv), additionalData: chunkIndex(index) },
        key,
        copyBytes(cipher),
      ),
    );
  } catch {
    throw new FieldCryptoError();
  }
}

function prefixFrame(prefix: Uint8Array, frame: Uint8Array) {
  const sealed = new Uint8Array(prefix.byteLength + frame.byteLength);
  sealed.set(prefix, 0);
  sealed.set(frame, prefix.byteLength);
  return sealed;
}

/**
 * R2 requires every part except the last to be the same size.
 * Part 1 carries the XYC1 header. Later full parts carry an equal-sized
 * alignment prefix so complete() can assemble the object. The last part
 * is only its frame and may be shorter.
 */
export async function sealPart(
  plain: Uint8Array,
  partNumber: number,
  partCount: number,
  header: Uint8Array | null,
  key: CryptoKey,
) {
  const frame = await encryptChunk(plain, partNumber - 1, key);
  if (partNumber === 1) {
    if (!header || header.byteLength !== HEADER_BYTES) throw new FieldCryptoError();
    return prefixFrame(header, frame);
  }
  if (partNumber < partCount) return prefixFrame(new Uint8Array(HEADER_BYTES), frame);
  return frame;
}

export class ByteSource {
  private readonly chunks: Uint8Array[] = [];
  private buffered = 0;
  private readonly next: () => Promise<Uint8Array | null>;

  constructor(next: () => Promise<Uint8Array | null>) {
    this.next = next;
  }

  async readAtMost(length: number) {
    while (this.buffered < length) {
      const chunk = await this.next();
      if (!chunk) break;
      if (chunk.byteLength === 0) continue;
      this.chunks.push(chunk);
      this.buffered += chunk.byteLength;
    }
    const take = Math.min(length, this.buffered);
    if (take === 0) return new Uint8Array();
    return (await this.readExact(take)) ?? new Uint8Array();
  }

  async readExact(length: number) {
    while (this.buffered < length) {
      const chunk = await this.next();
      if (!chunk) return null;
      if (chunk.byteLength === 0) continue;
      this.chunks.push(chunk);
      this.buffered += chunk.byteLength;
    }
    const out = new Uint8Array(length);
    let filled = 0;
    while (filled < length) {
      const head = this.chunks[0];
      if (!head) return null;
      const take = Math.min(head.byteLength, length - filled);
      out.set(head.subarray(0, take), filled);
      filled += take;
      this.buffered -= take;
      if (take === head.byteLength) this.chunks.shift();
      else this.chunks[0] = head.subarray(take);
    }
    return out;
  }

  restStream() {
    const chunks = this.chunks;
    const next = this.next;
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        const head = chunks.shift();
        if (head && head.byteLength > 0) {
          controller.enqueue(head);
          return;
        }
        const chunk = await next();
        if (!chunk || chunk.byteLength === 0) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
      },
    });
  }
}

export function byteSourceFrom(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  return new ByteSource(async () => {
    const next = await reader.read();
    if (next.done) return null;
    return next.value;
  });
}

export function decryptChunkedStream(header: ChunkHeader, source: ByteSource, key: CryptoKey) {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= header.chunkCount) {
        controller.close();
        return;
      }
      if (index > 0 && index < header.chunkCount - 1) {
        const pad = await source.readExact(HEADER_BYTES);
        if (!pad) {
          controller.error(new FieldCryptoError());
          return;
        }
      }
      const plainLength = partPlainLength(header.totalPlainSize, header.chunkPlainSize, index + 1);
      const frame = await source.readExact(IV_BYTES + plainLength + TAG_BYTES);
      if (!frame) {
        controller.error(new FieldCryptoError());
        return;
      }
      try {
        const plain = await decryptChunk(frame, index, key);
        if (plain.byteLength !== plainLength) {
          controller.error(new FieldCryptoError());
          return;
        }
        controller.enqueue(plain);
        index += 1;
        if (index >= header.chunkCount) controller.close();
      } catch (error) {
        controller.error(error instanceof Error ? error : new FieldCryptoError());
      }
    },
  });
}

function startsWith(bytes: Uint8Array, magic: number[]) {
  return magic.every((value, index) => bytes[index] === value);
}

export async function openPlaintext(stream: ReadableStream<Uint8Array>, objectSize: number, key: CryptoKey) {
  const source = byteSourceFrom(stream);
  const magic = await source.readAtMost(4);
  if (magic.byteLength < 4) return { kind: "bytes" as const, bytes: magic };
  if (startsWith(magic, MAGIC)) {
    const rest = await source.readExact(HEADER_BYTES - 4);
    if (!rest) throw new FieldCryptoError();
    const packed = new Uint8Array(HEADER_BYTES);
    packed.set(magic, 0);
    packed.set(rest, 4);
    const header = decodeChunkHeader(packed);
    if (!header) throw new FieldCryptoError();
    return { kind: "stream" as const, stream: decryptChunkedStream(header, source, key) };
  }
  if (startsWith(magic, XYE1)) {
    const cap = SINGLE_UPLOAD_BYTES + HEADER_BYTES + TAG_BYTES;
    if (objectSize > cap) throw new FieldCryptoError();
    const chunks: Uint8Array[] = [magic];
    let total = magic.byteLength;
    while (total < objectSize) {
      const next = await source.readExact(Math.min(64 * 1024, objectSize - total));
      if (!next) break;
      chunks.push(next);
      total += next.byteLength;
    }
    const stored = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      stored.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { kind: "bytes" as const, bytes: await decryptBytes(stored) };
  }
  const prefix = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(magic);
      controller.close();
    },
  });
  return { kind: "stream" as const, stream: concatStreams(prefix, source.restStream()) };
}

function concatStreams(first: ReadableStream<Uint8Array>, second: ReadableStream<Uint8Array>) {
  const streams = [first, second];
  let current = 0;
  let reader = streams[0]?.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (reader) {
        const next = await reader.read();
        if (!next.done) {
          controller.enqueue(next.value);
          return;
        }
        current += 1;
        reader = streams[current]?.getReader();
      }
      controller.close();
    },
  });
}
