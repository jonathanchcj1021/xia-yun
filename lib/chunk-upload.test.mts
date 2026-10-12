import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_UPLOAD_BYTES, SINGLE_UPLOAD_BYTES, UPLOAD_PART_BYTES } from "./constants.ts";
import { openPlaintext } from "./chunk-crypto.ts";
import { decryptBytes, encryptBytes } from "./field-crypto.ts";
import { chooseUploadMode, planUpload } from "./upload-plan.ts";
import {
  beginUpload,
  cancelUpload,
  finishUpload,
  sweepStaleSessions,
  writePart,
  type ObjectStore,
  type StoredPart,
  type UploadMeta,
} from "./upload-session.ts";

process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

function bytesOf(text: string) {
  return new TextEncoder().encode(text);
}

async function readAll(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    chunks.push(next.value);
    total += next.value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function memoryStore(): ObjectStore & {
  objects: Map<string, Uint8Array>;
  pending: Map<string, Map<number, Uint8Array>>;
  created: number;
} {
  const objects = new Map<string, Uint8Array>();
  const pending = new Map<string, Map<number, Uint8Array>>();
  let created = 0;
  const store: ObjectStore & {
    objects: Map<string, Uint8Array>;
    pending: Map<string, Map<number, Uint8Array>>;
    created: number;
  } = {
    objects,
    pending,
    get created() {
      return created;
    },
    set created(value: number) {
      created = value;
    },
    async put(key, bytes) {
      objects.set(key, bytes);
    },
    async get(key) {
      const found = objects.get(key);
      return found ? new Uint8Array(found) : null;
    },
    async delete(key) {
      objects.delete(key);
    },
    async list(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix));
    },
    async createMultipart(key) {
      created += 1;
      pending.set(key, new Map());
      return `upload-${created}`;
    },
    async uploadPart(key, _uploadId, partNumber, body) {
      const parts = pending.get(key);
      if (!parts) throw new Error("missing multipart");
      parts.set(partNumber, body);
      return `etag-${partNumber}-${body.byteLength}`;
    },
    async completeMultipart(key, _uploadId, parts: StoredPart[]) {
      const stored = pending.get(key);
      if (!stored) throw new Error("missing multipart");
      const ordered = [...parts].sort((left, right) => left.partNumber - right.partNumber);
      let total = 0;
      const bodies: Uint8Array[] = [];
      for (const part of ordered) {
        const body = stored.get(part.partNumber);
        if (!body) throw new Error("missing part");
        bodies.push(body);
        total += body.byteLength;
      }
      const joined = new Uint8Array(total);
      let offset = 0;
      for (const body of bodies) {
        joined.set(body, offset);
        offset += body.byteLength;
      }
      objects.set(key, joined);
      pending.delete(key);
    },
    async abortMultipart(key) {
      pending.delete(key);
    },
    async open(key) {
      const found = objects.get(key);
      if (!found || key.startsWith("staging/")) return null;
      return {
        size: found.byteLength,
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(found);
            controller.close();
          },
        }),
      };
    },
  };
  return store;
}

async function testKey() {
  return crypto.subtle.importKey("raw", Buffer.alloc(32, 7), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

describe("upload limit", () => {
  it("keeps a 32 MB file on the single request and splits 1 GiB into 8 MiB parts", () => {
    assert.equal(MAX_UPLOAD_BYTES, 1073741824);
    assert.equal(chooseUploadMode(0), "single");
    assert.equal(chooseUploadMode(SINGLE_UPLOAD_BYTES), "single");
    assert.equal(chooseUploadMode(SINGLE_UPLOAD_BYTES + 1), "chunked");
    assert.equal(chooseUploadMode(MAX_UPLOAD_BYTES), "chunked");
    assert.equal(chooseUploadMode(MAX_UPLOAD_BYTES + 1), "reject");
    const planned = planUpload(MAX_UPLOAD_BYTES);
    assert.equal("error" in planned, false);
    if ("error" in planned) return;
    assert.equal(planned.partSize, UPLOAD_PART_BYTES);
    assert.equal(planned.partSize, 8 * 1024 * 1024);
    assert.equal(planned.partCount, 128);
    const rejected = planUpload(MAX_UPLOAD_BYTES + 1);
    assert.deepEqual(rejected, { error: "too-large" });
  });

  it("still encrypts a small file as one XYE1 object", async () => {
    const plain = bytesOf("small-file");
    const stored = await encryptBytes(plain);
    assert.equal(stored[0], 0x58);
    assert.equal(stored[1], 0x59);
    assert.equal(stored[2], 0x45);
    assert.equal(stored[3], 0x31);
    const opened = await openPlaintext(
      new ReadableStream({
        start(controller) {
          controller.enqueue(stored);
          controller.close();
        },
      }),
      stored.byteLength,
      await testKey(),
    );
    assert.equal(opened.kind, "bytes");
    if (opened.kind !== "bytes") return;
    assert.deepEqual(opened.bytes, await decryptBytes(stored));
    assert.deepEqual(opened.bytes, plain);
  });

  it("streams legacy plaintext, including a file shorter than the magic", async () => {
    const key = await testKey();
    const plain = bytesOf("legacy-plain");
    const split = await openPlaintext(
      new ReadableStream({
        start(controller) {
          controller.enqueue(plain.subarray(0, 3));
          controller.enqueue(plain.subarray(3));
          controller.close();
        },
      }),
      plain.byteLength,
      key,
    );
    assert.equal(split.kind, "stream");
    if (split.kind !== "stream") return;
    assert.deepEqual(await readAll(split.stream), plain);
    const tiny = bytesOf("ab");
    const short = await openPlaintext(
      new ReadableStream({
        start(controller) {
          controller.enqueue(tiny);
          controller.close();
        },
      }),
      tiny.byteLength,
      key,
    );
    assert.equal(short.kind, "bytes");
    if (short.kind !== "bytes") return;
    assert.deepEqual(short.bytes, tiny);
  });

  it("rejects a file over 1 GiB before any multipart object exists", async () => {
    const store = memoryStore();
    const started = await beginUpload(
      store,
      {
        uploadId: "11111111-1111-4111-8111-111111111111",
        itemId: "22222222-2222-4222-8222-222222222222",
        userId: "33333333-3333-4333-8333-333333333333",
        name: "big.bin",
        type: "file",
        mimeType: "application/octet-stream",
        size: MAX_UPLOAD_BYTES + 1,
        group: null,
        tags: [],
        now: 1,
      },
      async () => false,
    );
    assert.equal("status" in started && started.status, 413);
    if (!("status" in started)) return;
    assert.equal(started.code, "PAYLOAD_TOO_LARGE");
    assert.equal(started.message, "檔案超過 1 GB 上限");
    assert.equal(store.created, 0);
    assert.equal(store.pending.size, 0);
  });

  it("assembles chunked ciphertext and streams the plaintext back", async () => {
    const store = memoryStore();
    const userId = "33333333-3333-4333-8333-333333333333";
    const plain = bytesOf("abcdefghij");
    const started = await beginUpload(
      store,
      {
        uploadId: "11111111-1111-4111-8111-111111111111",
        itemId: "22222222-2222-4222-8222-222222222222",
        userId,
        name: "note.bin",
        type: "file",
        mimeType: "application/octet-stream",
        size: plain.byteLength,
        group: null,
        tags: [],
        now: 10,
        partSize: 4,
      },
      async () => false,
    );
    assert.equal("meta" in started, true);
    if (!("meta" in started)) return;
    const meta = started.meta as UploadMeta;
    assert.equal(meta.partCount, 3);
    assert.equal(store.objects.has(meta.objectKey), false);
    const key = await testKey();
    for (let part = 1; part <= meta.partCount; part += 1) {
      const start = (part - 1) * 4;
      const written = await writePart(store, userId, meta.uploadId, part, plain.subarray(start, start + 4), key);
      assert.equal("ok" in written, true);
    }
    const short = await writePart(store, userId, meta.uploadId, 3, plain.subarray(0, 1), key);
    assert.equal("status" in short && short.status, 400);
    const finished = await finishUpload(store, userId, meta.uploadId);
    assert.equal("meta" in finished, true);
    const opened = await store.open(meta.objectKey);
    assert.ok(opened);
    if (!opened) return;
    const decoded = await openPlaintext(opened.stream, opened.size, key);
    assert.equal(decoded.kind, "stream");
    if (decoded.kind !== "stream") return;
    assert.deepEqual(await readAll(decoded.stream), plain);
    assert.equal(store.pending.size, 0);
  });

  it("drops an unfinished upload instead of keeping the object", async () => {
    const store = memoryStore();
    const userId = "33333333-3333-4333-8333-333333333333";
    const started = await beginUpload(
      store,
      {
        uploadId: "11111111-1111-4111-8111-111111111111",
        itemId: "22222222-2222-4222-8222-222222222222",
        userId,
        name: "half.bin",
        type: "file",
        mimeType: "application/octet-stream",
        size: 8,
        group: null,
        tags: [],
        now: 10,
        partSize: 4,
      },
      async () => false,
    );
    if (!("meta" in started)) throw new Error("expected session");
    const key = await testKey();
    await writePart(store, userId, started.meta.uploadId, 1, bytesOf("abcd"), key);
    assert.equal(await store.open(started.meta.objectKey), null);
    const cancelled = await cancelUpload(store, userId, started.meta.uploadId);
    assert.equal("ok" in cancelled, true);
    assert.equal(store.pending.size, 0);
    assert.equal(store.objects.size, 0);
    const stale = await beginUpload(
      store,
      {
        uploadId: "44444444-4444-4444-8444-444444444444",
        itemId: "55555555-5555-4555-8555-555555555555",
        userId,
        name: "old.bin",
        type: "file",
        mimeType: "application/octet-stream",
        size: 4,
        group: null,
        tags: [],
        now: 1,
        partSize: 4,
      },
      async () => false,
    );
    if (!("meta" in stale)) throw new Error("expected stale session");
    await sweepStaleSessions(store, userId, 1 + 24 * 60 * 60 * 1000 + 5, async () => false);
    assert.equal(store.pending.size, 0);
    assert.equal(store.objects.size, 0);
  });
});
