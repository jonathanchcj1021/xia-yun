import { getCloudflareContext } from "@opennextjs/cloudflare";

function bindable(params: unknown[]) {
  return params.map((value) => (value === undefined ? null : value));
}

async function bindings() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB || !env.BLOBS) {
    throw new Error("需要 Cloudflare D1（DB）與 R2（BLOBS）綁定");
  }
  return env;
}

export async function queryAll<T extends Record<string, unknown>>(
  sql: string,
  ...params: unknown[]
) {
  const { DB } = await bindings();
  const statement = DB.prepare(sql);
  const bound = params.length ? statement.bind(...bindable(params)) : statement;
  const result = await bound.all<T>();
  return (result.results ?? []) as T[];
}

export async function queryOne<T extends Record<string, unknown>>(
  sql: string,
  ...params: unknown[]
) {
  const { DB } = await bindings();
  const statement = DB.prepare(sql);
  const bound = params.length ? statement.bind(...bindable(params)) : statement;
  return (await bound.first<T>()) as T | null;
}

export async function execute(sql: string, ...params: unknown[]) {
  const { DB } = await bindings();
  const statement = DB.prepare(sql);
  const bound = params.length ? statement.bind(...bindable(params)) : statement;
  return bound.run();
}

export function blobKey(userId: string, itemId: string) {
  return `${userId}/${itemId}`;
}

export async function putBlob(
  userId: string,
  itemId: string,
  bytes: Uint8Array,
  mimeType: string,
) {
  const { BLOBS } = await bindings();
  await BLOBS.put(blobKey(userId, itemId), bytes, {
    httpMetadata: { contentType: mimeType },
  });
}

export async function getBlob(userId: string, itemId: string) {
  const { BLOBS } = await bindings();
  const object = await BLOBS.get(blobKey(userId, itemId));
  if (!object) return null;
  return new Uint8Array(await object.arrayBuffer());
}

export async function deleteBlob(userId: string, itemId: string) {
  const { BLOBS } = await bindings();
  await BLOBS.delete(blobKey(userId, itemId));
}

type ListedObjects = { objects: { key: string }[]; truncated?: boolean; cursor?: string };

type MultipartUpload = {
  uploadId: string;
  uploadPart(partNumber: number, value: Uint8Array): Promise<{ etag: string; partNumber: number }>;
  complete(parts: { etag: string; partNumber: number }[]): Promise<unknown>;
  abort(): Promise<void>;
};

type MultipartBucket = {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ size: number; body: ReadableStream<Uint8Array> } | null>;
  delete(key: string | string[]): Promise<void>;
  list(options: { prefix?: string; limit?: number; cursor?: string }): Promise<ListedObjects>;
  createMultipartUpload(
    key: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<MultipartUpload>;
  resumeMultipartUpload(key: string, uploadId: string): MultipartUpload;
};

async function multipartBucket() {
  const { BLOBS } = await bindings();
  return BLOBS as unknown as MultipartBucket;
}

export async function r2ObjectStore() {
  const bucket = await multipartBucket();
  return {
    async put(key: string, bytes: Uint8Array) {
      await bucket.put(key, bytes, { httpMetadata: { contentType: "application/json" } });
    },
    async get(key: string) {
      const object = await bucket.get(key);
      if (!object) return null;
      const reader = object.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        chunks.push(next.value);
        total += next.value.byteLength;
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes;
    },
    async delete(key: string) {
      await bucket.delete(key);
    },
    async list(prefix: string) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ prefix, limit: 100, cursor });
        for (const object of page.objects) keys.push(object.key);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return keys;
    },
    async createMultipart(key: string, contentType: string) {
      const upload = await bucket.createMultipartUpload(key, {
        httpMetadata: { contentType },
      });
      return upload.uploadId;
    },
    async uploadPart(key: string, uploadId: string, partNumber: number, body: Uint8Array) {
      const upload = bucket.resumeMultipartUpload(key, uploadId);
      const part = await upload.uploadPart(partNumber, body);
      return part.etag;
    },
    async completeMultipart(
      key: string,
      uploadId: string,
      parts: { partNumber: number; etag: string }[],
    ) {
      const upload = bucket.resumeMultipartUpload(key, uploadId);
      await upload.complete(parts);
    },
    async abortMultipart(key: string, uploadId: string) {
      const upload = bucket.resumeMultipartUpload(key, uploadId);
      await upload.abort();
    },
    async open(key: string) {
      const object = await bucket.get(key);
      if (!object) return null;
      return { size: object.size, stream: object.body };
    },
  };
}

export async function openBlob(userId: string, itemId: string) {
  const bucket = await multipartBucket();
  const object = await bucket.get(blobKey(userId, itemId));
  if (!object) return null;
  return { size: object.size, stream: object.body };
}
