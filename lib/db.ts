import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { xiayunDb?: DatabaseSync };

export const dataDir = path.join(process.cwd(), "data");
export const blobDir = path.join(dataDir, "blobs");

function openDatabase() {
  fs.mkdirSync(blobDir, { recursive: true });
  const database = new DatabaseSync(path.join(dataDir, "app.sqlite"));
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('file', 'image', 'text')),
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT,
      body TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS items_user_created
      ON items (user_id, created_at DESC);
  `);
  return database;
}

export function getDb() {
  if (!globalForDb.xiayunDb) {
    globalForDb.xiayunDb = openDatabase();
  }
  return globalForDb.xiayunDb;
}

export function blobPath(userId: string, itemId: string) {
  return path.join(blobDir, userId, itemId);
}
