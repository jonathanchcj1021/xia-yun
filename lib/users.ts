import { randomBytes, createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isHttps } from "@/lib/http";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/constants";
import type { PublicUser } from "@/lib/types";

export type { PublicUser };

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
};

function toPublicUser(row: Pick<UserRow, "id" | "email" | "created_at">): PublicUser {
  return {
    id: row.id,
    email: row.email,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps(request),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function purgeExpiredSessions() {
  getDb()
    .prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .run(Date.now());
}

export async function createSession(request: NextRequest, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      tokenHash(token),
      userId,
      now + SESSION_MAX_AGE_SECONDS * 1000,
      now,
    );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(request));
}

export async function clearSession(request: NextRequest) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  }
  jar.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(request),
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  purgeExpiredSessions();
  const row = getDb()
    .prepare(
      `SELECT users.id AS id, users.email AS email, users.created_at AS created_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(tokenHash(token), Date.now()) as
    | Pick<UserRow, "id" | "email" | "created_at">
    | undefined;
  if (!row) return null;
  return toPublicUser(row);
}

export async function registerUser(email: string, password: string) {
  const id = randomUUID();
  const now = Date.now();
  const passwordHash = await hashPassword(password);
  try {
    getDb()
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(id, email, passwordHash, now);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return { taken: true as const };
    }
    throw error;
  }
  return {
    user: toPublicUser({ id, email, created_at: now }),
  };
}

let dummyHashPromise: Promise<string> | null = null;

function dummyHash() {
  dummyHashPromise ??= hashPassword("not-a-real-password");
  return dummyHashPromise;
}

export async function authenticate(email: string, password: string) {
  const row = getDb()
    .prepare(
      `SELECT id, email, password_hash, created_at FROM users WHERE email = ?`,
    )
    .get(email) as UserRow | undefined;
  const passwordHash = row?.password_hash ?? (await dummyHash());
  const matches = await verifyPassword(password, passwordHash);
  if (!row || !matches) return null;
  return toPublicUser(row);
}
