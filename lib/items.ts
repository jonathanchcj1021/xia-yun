import { randomUUID } from "node:crypto";
import { deleteBlob, execute, getBlob, putBlob, queryAll, queryOne } from "@/lib/db";
import { decryptBytes, decryptText, encryptBytes, encryptText } from "@/lib/field-crypto";
import type { ItemType } from "@/lib/constants";

export type ItemRecord = {
  id: string;
  ownerId: string;
  type: ItemType;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
  excerpt: string | null;
  body: string | null;
  group: string | null;
  tags: string[];
};

type ItemRow = {
  id: string;
  user_id: string;
  type: ItemType;
  name: string;
  size: number;
  mime_type: string | null;
  body: string | null;
  created_at: number;
  item_group: string | null;
  tags: string | null;
};

export type ItemMeta = {
  group?: string | null;
  tags?: string[];
};

function excerptOf(body: string | null) {
  if (!body) return null;
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return compact.length > 120 ? `${compact.slice(0, 120)}…` : compact;
}

function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

async function toItem(row: ItemRow, includeBody: boolean): Promise<ItemRecord> {
  const plain = row.type === "text" && row.body != null ? await decryptText(row.body) : row.body;
  return {
    id: row.id,
    ownerId: row.user_id,
    type: row.type,
    name: row.name,
    size: Number(row.size),
    mimeType: row.mime_type,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    excerpt: row.type === "text" ? excerptOf(plain) : null,
    body: includeBody && row.type === "text" ? (plain ?? "") : null,
    group: row.item_group?.trim() ? row.item_group : null,
    tags: parseTags(row.tags),
  };
}

const itemColumns = `id, user_id, type, name, size, mime_type, body, created_at, item_group, tags`;

export async function listItems(userId: string) {
  const rows = await queryAll<ItemRow>(
    `SELECT ${itemColumns} FROM items
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    userId,
  );
  return Promise.all(rows.map((row) => toItem(row, false)));
}

export async function getItem(userId: string, itemId: string) {
  const row = await queryOne<ItemRow>(
    `SELECT ${itemColumns} FROM items WHERE id = ? AND user_id = ?`,
    itemId,
    userId,
  );
  if (!row) return null;
  return toItem(row, true);
}

export async function createTextItem(
  userId: string,
  title: string,
  body: string,
  meta: ItemMeta = {},
) {
  const id = randomUUID();
  const now = Date.now();
  const size = Buffer.byteLength(body, "utf8");
  const stored = await encryptText(body);
  await execute(
    `INSERT INTO items
      (id, user_id, type, name, size, mime_type, body, created_at, item_group, tags)
     VALUES (?, ?, 'text', ?, ?, 'text/plain; charset=utf-8', ?, ?, ?, ?)`,
    id,
    userId,
    title,
    size,
    stored,
    now,
    meta.group ?? null,
    JSON.stringify(meta.tags ?? []),
  );
  const created = await getItem(userId, id);
  if (!created) throw new Error("寫入文字項目後讀不到資料");
  return created;
}

export async function createBlobItem(input: {
  userId: string;
  type: "file" | "image";
  name: string;
  mimeType: string;
  bytes: Buffer;
  group?: string | null;
  tags?: string[];
}) {
  const id = randomUUID();
  const now = Date.now();
  const stored = await encryptBytes(input.bytes);
  await putBlob(input.userId, id, stored, input.mimeType);
  try {
    await execute(
      `INSERT INTO items
        (id, user_id, type, name, size, mime_type, body, created_at, item_group, tags)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      id,
      input.userId,
      input.type,
      input.name,
      input.bytes.length,
      input.mimeType,
      now,
      input.group ?? null,
      JSON.stringify(input.tags ?? []),
    );
  } catch (error) {
    await deleteBlob(input.userId, id);
    throw error;
  }
  const created = await getItem(input.userId, id);
  if (!created) throw new Error("寫入檔案項目後讀不到資料");
  return created;
}

export async function updateItemMeta(userId: string, itemId: string, patch: ItemMeta) {
  const existing = await getItem(userId, itemId);
  if (!existing) return null;
  if (patch.group !== undefined) {
    await execute(
      "UPDATE items SET item_group = ? WHERE id = ? AND user_id = ?",
      patch.group,
      itemId,
      userId,
    );
  }
  if (patch.tags !== undefined) {
    await execute(
      "UPDATE items SET tags = ? WHERE id = ? AND user_id = ?",
      JSON.stringify(patch.tags),
      itemId,
      userId,
    );
  }
  return getItem(userId, itemId);
}

export async function updateTextItem(
  userId: string,
  itemId: string,
  patch: { title?: string; body?: string },
) {
  const existing = await getItem(userId, itemId);
  if (!existing || existing.type !== "text") return null;
  if (patch.title !== undefined) {
    await execute("UPDATE items SET name = ? WHERE id = ? AND user_id = ?", patch.title, itemId, userId);
  }
  if (patch.body !== undefined) {
    const stored = await encryptText(patch.body);
    const size = Buffer.byteLength(patch.body, "utf8");
    await execute(
      "UPDATE items SET body = ?, size = ? WHERE id = ? AND user_id = ?",
      stored,
      size,
      itemId,
      userId,
    );
  }
  return getItem(userId, itemId);
}

export async function deleteGroup(userId: string, group: string | null) {
  const rows =
    group == null
      ? await queryAll<{ id: string; type: ItemType }>(
          `SELECT id, type FROM items
           WHERE user_id = ? AND (item_group IS NULL OR item_group = '')`,
          userId,
        )
      : await queryAll<{ id: string; type: ItemType }>(
          `SELECT id, type FROM items
           WHERE user_id = ? AND item_group = ?`,
          userId,
          group,
        );
  const result =
    group == null
      ? await execute(
          `DELETE FROM items
           WHERE user_id = ? AND (item_group IS NULL OR item_group = '')`,
          userId,
        )
      : await execute("DELETE FROM items WHERE user_id = ? AND item_group = ?", userId, group);
  for (const row of rows) {
    if (row.type === "text") continue;
    await deleteBlob(userId, row.id);
  }
  return Number(result.meta?.changes ?? 0);
}

export async function deleteItem(userId: string, itemId: string) {
  const existing = await getItem(userId, itemId);
  if (!existing) return false;
  await execute("DELETE FROM items WHERE id = ? AND user_id = ?", itemId, userId);
  if (existing.type !== "text") {
    await deleteBlob(userId, itemId);
  }
  return true;
}

export async function readBlob(userId: string, itemId: string) {
  const bytes = await getBlob(userId, itemId);
  if (!bytes) throw new Error("找不到檔案內容");
  return Buffer.from(await decryptBytes(bytes));
}
