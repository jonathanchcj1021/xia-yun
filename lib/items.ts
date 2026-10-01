import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { blobPath, getDb } from "@/lib/db";
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
};

function excerptOf(body: string | null) {
  if (!body) return null;
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return compact.length > 120 ? `${compact.slice(0, 120)}…` : compact;
}

function toItem(row: ItemRow, includeBody: boolean): ItemRecord {
  return {
    id: row.id,
    ownerId: row.user_id,
    type: row.type,
    name: row.name,
    size: Number(row.size),
    mimeType: row.mime_type,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    excerpt: row.type === "text" ? excerptOf(row.body) : null,
    body: includeBody && row.type === "text" ? (row.body ?? "") : null,
  };
}

const itemColumns = `id, user_id, type, name, size, mime_type, body, created_at`;

export function listItems(userId: string) {
  const rows = getDb()
    .prepare(
      `SELECT ${itemColumns} FROM items
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .all(userId) as unknown as ItemRow[];
  return rows.map((row) => toItem(row, false));
}

export function getItem(userId: string, itemId: string) {
  const row = getDb()
    .prepare(
      `SELECT ${itemColumns} FROM items WHERE id = ? AND user_id = ?`,
    )
    .get(itemId, userId) as unknown as ItemRow | undefined;
  if (!row) return null;
  return toItem(row, true);
}

export async function createTextItem(
  userId: string,
  title: string,
  body: string,
) {
  const id = randomUUID();
  const now = Date.now();
  const size = Buffer.byteLength(body, "utf8");
  getDb()
    .prepare(
      `INSERT INTO items
        (id, user_id, type, name, size, mime_type, body, created_at)
       VALUES (?, ?, 'text', ?, ?, 'text/plain; charset=utf-8', ?, ?)`,
    )
    .run(id, userId, title, size, body, now);
  return getItem(userId, id)!;
}

export async function createBlobItem(input: {
  userId: string;
  type: "file" | "image";
  name: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const id = randomUUID();
  const now = Date.now();
  const destination = blobPath(input.userId, id);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, input.bytes);
  try {
    getDb()
      .prepare(
        `INSERT INTO items
          (id, user_id, type, name, size, mime_type, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      )
      .run(
        id,
        input.userId,
        input.type,
        input.name,
        input.bytes.length,
        input.mimeType,
        now,
      );
  } catch (error) {
    await fs.rm(destination, { force: true });
    throw error;
  }
  return getItem(input.userId, id)!;
}

export async function deleteItem(userId: string, itemId: string) {
  const existing = getItem(userId, itemId);
  if (!existing) return false;
  getDb()
    .prepare("DELETE FROM items WHERE id = ? AND user_id = ?")
    .run(itemId, userId);
  if (existing.type !== "text") {
    await fs.rm(blobPath(userId, itemId), { force: true });
  }
  return true;
}

export async function readBlob(userId: string, itemId: string) {
  return fs.readFile(blobPath(userId, itemId));
}
