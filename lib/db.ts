import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { xiayunDb?: DatabaseSync };

export const dataDir = path.join(process.cwd(), "data");
export const blobDir = path.join(dataDir, "blobs");

function migrate(database: DatabaseSync) {
  database.exec(`
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

    CREATE TABLE IF NOT EXISTS passkeys (
      credential_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL,
      transports TEXT,
      device_type TEXT,
      backed_up INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      rp_id TEXT
    );

    CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys (user_id);
  `);
  const passkeyColumns = database.prepare("PRAGMA table_info(passkeys)").all() as {
    name: string;
  }[];
  if (!passkeyColumns.some((column) => column.name === "rp_id")) {
    database.exec("ALTER TABLE passkeys ADD COLUMN rp_id TEXT");
  }
  const itemColumns = database.prepare("PRAGMA table_info(items)").all() as { name: string }[];
  if (!itemColumns.some((column) => column.name === "item_group")) {
    database.exec("ALTER TABLE items ADD COLUMN item_group TEXT");
  }
  if (!itemColumns.some((column) => column.name === "tags")) {
    database.exec("ALTER TABLE items ADD COLUMN tags TEXT");
  }
  database.exec(`

    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email TEXT,
      purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
      challenge TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
}

function openDatabase() {
  fs.mkdirSync(blobDir, { recursive: true });
  const database = new DatabaseSync(path.join(dataDir, "app.sqlite"));
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  migrate(database);
  return database;
}

export function getDb() {
  if (!globalForDb.xiayunDb) {
    globalForDb.xiayunDb = openDatabase();
  } else {
    migrate(globalForDb.xiayunDb);
  }
  return globalForDb.xiayunDb;
}

export function blobPath(userId: string, itemId: string) {
  return path.join(blobDir, userId, itemId);
}
