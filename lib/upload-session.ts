import { UPLOAD_SESSION_TTL_MS } from "@/lib/constants";
import { dataEncryptionKey } from "@/lib/field-crypto";
import { encodeChunkHeader, sealPart } from "@/lib/chunk-crypto";
import { partPlainLength, planUpload } from "@/lib/upload-plan";

export const FILE_TOO_LARGE = "檔案超過 1 GB 上限";
export const PART_LENGTH = "分段長度不正確";
export const UPLOAD_MISSING = "找不到這個上傳";
export const UPLOAD_INCOMPLETE = "上傳尚未完成";

export type StoredPart = { partNumber: number; etag: string };

export type UploadMeta = {
  uploadId: string;
  userId: string;
  itemId: string;
  r2UploadId: string;
  objectKey: string;
  name: string;
  type: "file" | "image";
  mimeType: string;
  size: number;
  group: string | null;
  tags: string[];
  partSize: number;
  partCount: number;
  parts: StoredPart[];
  createdAt: number;
};

export type ObjectStore = {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  createMultipart(key: string, contentType: string): Promise<string>;
  uploadPart(key: string, uploadId: string, partNumber: number, body: Uint8Array): Promise<string>;
  completeMultipart(key: string, uploadId: string, parts: StoredPart[]): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
  open(key: string): Promise<{ size: number; stream: ReadableStream<Uint8Array> } | null>;
};

export type SessionFailure = {
  status: 400 | 404 | 413;
  code: "VALIDATION" | "NOT_FOUND" | "PAYLOAD_TOO_LARGE";
  message: string;
};

function failure(
  status: SessionFailure["status"],
  code: SessionFailure["code"],
  message: string,
): SessionFailure {
  return { status, code, message };
}

export function stagingKey(userId: string, uploadId: string) {
  return `staging/${userId}/${uploadId}.json`;
}

function isStoredPart(value: unknown): value is StoredPart {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.partNumber === "number" && typeof record.etag === "string";
}

export function parseMeta(bytes: Uint8Array): UploadMeta | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.uploadId !== "string" ||
      typeof record.userId !== "string" ||
      typeof record.itemId !== "string" ||
      typeof record.r2UploadId !== "string" ||
      typeof record.objectKey !== "string" ||
      typeof record.name !== "string" ||
      (record.type !== "file" && record.type !== "image") ||
      typeof record.mimeType !== "string" ||
      typeof record.size !== "number" ||
      (record.group !== null && typeof record.group !== "string") ||
      !Array.isArray(record.tags) ||
      !record.tags.every((tag) => typeof tag === "string") ||
      typeof record.partSize !== "number" ||
      typeof record.partCount !== "number" ||
      !Array.isArray(record.parts) ||
      !record.parts.every(isStoredPart) ||
      typeof record.createdAt !== "number"
    ) {
      return null;
    }
    return {
      uploadId: record.uploadId,
      userId: record.userId,
      itemId: record.itemId,
      r2UploadId: record.r2UploadId,
      objectKey: record.objectKey,
      name: record.name,
      type: record.type,
      mimeType: record.mimeType,
      size: record.size,
      group: record.group,
      tags: record.tags,
      partSize: record.partSize,
      partCount: record.partCount,
      parts: record.parts,
      createdAt: record.createdAt,
    };
  } catch {
    return null;
  }
}

function encodeMeta(meta: UploadMeta) {
  return new TextEncoder().encode(JSON.stringify(meta));
}

async function loadMeta(store: ObjectStore, userId: string, uploadId: string) {
  const bytes = await store.get(stagingKey(userId, uploadId));
  if (!bytes) return null;
  const meta = parseMeta(bytes);
  if (!meta || meta.userId !== userId || meta.uploadId !== uploadId) return null;
  return meta;
}

export async function sweepStaleSessions(
  store: ObjectStore,
  userId: string,
  now: number,
  itemExists: (itemId: string) => Promise<boolean>,
) {
  const keys = await store.list(`staging/${userId}/`);
  for (const key of keys) {
    const bytes = await store.get(key);
    if (!bytes) continue;
    const meta = parseMeta(bytes);
    if (!meta || now - meta.createdAt < UPLOAD_SESSION_TTL_MS) continue;
    const exists = await itemExists(meta.itemId);
    if (!exists) {
      await store.abortMultipart(meta.objectKey, meta.r2UploadId).catch(() => undefined);
      await store.delete(meta.objectKey);
    }
    await store.delete(key);
  }
}

export async function beginUpload(
  store: ObjectStore,
  input: {
    uploadId: string;
    itemId: string;
    userId: string;
    name: string;
    type: "file" | "image";
    mimeType: string;
    size: number;
    group: string | null;
    tags: string[];
    now: number;
    partSize?: number;
  },
  itemExists: (itemId: string) => Promise<boolean>,
) {
  const plan = planUpload(input.size, input.partSize);
  if ("error" in plan) {
    return failure(
      plan.error === "too-large" ? 413 : 400,
      plan.error === "too-large" ? "PAYLOAD_TOO_LARGE" : "VALIDATION",
      plan.error === "too-large" ? FILE_TOO_LARGE : "請選擇要上傳的檔案",
    );
  }
  await sweepStaleSessions(store, input.userId, input.now, itemExists);
  const objectKey = `${input.userId}/${input.itemId}`;
  const r2UploadId = await store.createMultipart(objectKey, input.mimeType);
  const meta: UploadMeta = {
    uploadId: input.uploadId,
    userId: input.userId,
    itemId: input.itemId,
    r2UploadId,
    objectKey,
    name: input.name,
    type: input.type,
    mimeType: input.mimeType,
    size: input.size,
    group: input.group,
    tags: input.tags,
    partSize: plan.partSize,
    partCount: plan.partCount,
    parts: [],
    createdAt: input.now,
  };
  try {
    await store.put(stagingKey(input.userId, input.uploadId), encodeMeta(meta));
  } catch (error) {
    await store.abortMultipart(objectKey, r2UploadId).catch(() => undefined);
    throw error;
  }
  return { meta };
}

export async function writePart(
  store: ObjectStore,
  userId: string,
  uploadId: string,
  partNumber: number,
  plain: Uint8Array,
  key?: CryptoKey,
) {
  const meta = await loadMeta(store, userId, uploadId);
  if (!meta) return failure(404, "NOT_FOUND", UPLOAD_MISSING);
  if (!Number.isSafeInteger(partNumber) || partNumber < 1 || partNumber > meta.partCount) {
    return failure(400, "VALIDATION", PART_LENGTH);
  }
  const expected = partPlainLength(meta.size, meta.partSize, partNumber);
  if (plain.byteLength !== expected) return failure(400, "VALIDATION", PART_LENGTH);
  const cryptoKey = key ?? (await dataEncryptionKey());
  const header =
    partNumber === 1
      ? encodeChunkHeader({
          chunkPlainSize: meta.partSize,
          totalPlainSize: meta.size,
          chunkCount: meta.partCount,
        })
      : null;
  const sealed = await sealPart(plain, partNumber, header, cryptoKey);
  const etag = await store.uploadPart(meta.objectKey, meta.r2UploadId, partNumber, sealed);
  const parts = meta.parts.filter((part) => part.partNumber !== partNumber);
  parts.push({ partNumber, etag });
  parts.sort((left, right) => left.partNumber - right.partNumber);
  await store.put(stagingKey(userId, uploadId), encodeMeta({ ...meta, parts }));
  return { ok: true as const };
}

export async function finishUpload(store: ObjectStore, userId: string, uploadId: string) {
  const meta = await loadMeta(store, userId, uploadId);
  if (!meta) return failure(404, "NOT_FOUND", UPLOAD_MISSING);
  if (meta.parts.length !== meta.partCount) return failure(400, "VALIDATION", UPLOAD_INCOMPLETE);
  for (let partNumber = 1; partNumber <= meta.partCount; partNumber += 1) {
    if (!meta.parts.some((part) => part.partNumber === partNumber)) {
      return failure(400, "VALIDATION", UPLOAD_INCOMPLETE);
    }
  }
  const parts = [...meta.parts].sort((left, right) => left.partNumber - right.partNumber);
  await store.completeMultipart(meta.objectKey, meta.r2UploadId, parts);
  return { meta };
}

export async function cancelUpload(store: ObjectStore, userId: string, uploadId: string) {
  const meta = await loadMeta(store, userId, uploadId);
  if (!meta) return failure(404, "NOT_FOUND", UPLOAD_MISSING);
  await store.abortMultipart(meta.objectKey, meta.r2UploadId).catch(() => undefined);
  await store.delete(meta.objectKey);
  await store.delete(stagingKey(userId, uploadId));
  return { ok: true as const };
}

export async function discardStaging(store: ObjectStore, meta: UploadMeta) {
  await store.delete(stagingKey(meta.userId, meta.uploadId));
}
