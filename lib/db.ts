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
