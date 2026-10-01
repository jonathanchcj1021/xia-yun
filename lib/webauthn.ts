import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { WEBAUTHN_CHALLENGE_MS } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { isHttps } from "@/lib/http";

type ChallengePurpose = "register" | "login";

type PasskeyRow = {
  credential_id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  device_type: string | null;
  backed_up: number;
};

export function webAuthnContext(request: NextRequest) {
  const hostHeader = (request.headers.get("host") ?? request.nextUrl.host)
    .split(",")[0]
    ?.trim() || "localhost";
  const rpID = hostHeader.startsWith("[")
    ? hostHeader.slice(1, hostHeader.indexOf("]"))
    : hostHeader.replace(/:\d+$/, "");
  const originHeader = request.headers.get("origin");
  const origin =
    originHeader && originHeader !== "null"
      ? originHeader
      : `${isHttps(request) ? "https" : "http"}://${hostHeader}`;
  return { rpID, rpName: "匣雲", origin };
}

function saveChallenge(input: {
  userId?: string | null;
  email?: string | null;
  purpose: ChallengePurpose;
  challenge: string;
}) {
  const now = Date.now();
  getDb()
    .prepare(
      `DELETE FROM webauthn_challenges
       WHERE purpose = ?
         AND (
           (? IS NOT NULL AND user_id = ?)
           OR (? IS NOT NULL AND email = ?)
           OR expires_at <= ?
         )`,
    )
    .run(
      input.purpose,
      input.userId ?? null,
      input.userId ?? null,
      input.email ?? null,
      input.email ?? null,
      now,
    );
  getDb()
    .prepare(
      `INSERT INTO webauthn_challenges
        (id, user_id, email, purpose, challenge, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      input.userId ?? null,
      input.email ?? null,
      input.purpose,
      input.challenge,
      now + WEBAUTHN_CHALLENGE_MS,
    );
}

function takeChallenge(input: {
  userId?: string | null;
  email?: string | null;
  purpose: ChallengePurpose;
}) {
  const now = Date.now();
  const row = getDb()
    .prepare(
      `SELECT id, challenge FROM webauthn_challenges
       WHERE purpose = ?
         AND (? IS NULL OR user_id = ?)
         AND (? IS NULL OR email = ?)
         AND expires_at > ?
       ORDER BY expires_at DESC
       LIMIT 1`,
    )
    .get(
      input.purpose,
      input.userId ?? null,
      input.userId ?? null,
      input.email ?? null,
      input.email ?? null,
      now,
    ) as { id: string; challenge: string } | undefined;
  if (!row) return null;
  getDb().prepare("DELETE FROM webauthn_challenges WHERE id = ?").run(row.id);
  return row.challenge;
}

function listPasskeys(userId: string) {
  return getDb()
    .prepare(
      `SELECT credential_id, user_id, public_key, counter, transports, device_type, backed_up
       FROM passkeys WHERE user_id = ?`,
    )
    .all(userId) as unknown as PasskeyRow[];
}

function parseTransports(value: string | null) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return undefined;
  }
}

function toCredential(row: PasskeyRow) {
  return {
    id: row.credential_id,
    publicKey: isoBase64URL.toBuffer(row.public_key),
    counter: Number(row.counter),
    transports: parseTransports(row.transports),
  };
}

export async function registrationOptions(request: NextRequest, user: { id: string; email: string }) {
  const { rpID, rpName } = webAuthnContext(request);
  const existing = listPasskeys(user.id);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((row) => ({
      id: row.credential_id,
      transports: parseTransports(row.transports),
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
  saveChallenge({
    userId: user.id,
    purpose: "register",
    challenge: options.challenge,
  });
  return options;
}

export async function verifyRegistration(
  request: NextRequest,
  userId: string,
  response: RegistrationResponseJSON,
) {
  const expectedChallenge = takeChallenge({ userId, purpose: "register" });
  if (!expectedChallenge) return { error: "通行密鑰挑戰已過期，請再試一次" as const };
  const { rpID, origin } = webAuthnContext(request);
  let verified: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verified = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return { error: "通行密鑰驗證失敗" as const };
  }
  if (!verified.verified) return { error: "通行密鑰驗證失敗" as const };
  const credential = verified.registrationInfo.credential;
  getDb()
    .prepare(
      `INSERT INTO passkeys
        (credential_id, user_id, public_key, counter, transports, device_type, backed_up, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      credential.id,
      userId,
      isoBase64URL.fromBuffer(credential.publicKey),
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null,
      verified.registrationInfo.credentialDeviceType,
      verified.registrationInfo.credentialBackedUp ? 1 : 0,
      Date.now(),
    );
  return { ok: true as const };
}

export async function loginOptions(request: NextRequest, email: string) {
  const user = getDb()
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email) as { id: string } | undefined;
  const passkeys = user ? listPasskeys(user.id) : [];
  if (!user || passkeys.length === 0) {
    return { error: "無法使用通行密鑰登入" as const };
  }
  const { rpID } = webAuthnContext(request);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((row) => ({
      id: row.credential_id,
      transports: parseTransports(row.transports),
    })),
    userVerification: "preferred",
  });
  saveChallenge({ email, purpose: "login", challenge: options.challenge });
  return { options };
}

export async function verifyLogin(
  request: NextRequest,
  email: string,
  response: AuthenticationResponseJSON,
) {
  const expectedChallenge = takeChallenge({ email, purpose: "login" });
  if (!expectedChallenge) return { error: "通行密鑰挑戰已過期，請再試一次" as const };
  const user = getDb()
    .prepare("SELECT id, email, created_at FROM users WHERE email = ?")
    .get(email) as { id: string; email: string; created_at: number } | undefined;
  if (!user) return { error: "通行密鑰驗證失敗" as const };
  const row = listPasskeys(user.id).find((item) => item.credential_id === response.id);
  if (!row) return { error: "通行密鑰驗證失敗" as const };
  const { rpID, origin } = webAuthnContext(request);
  let verified: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: toCredential(row),
    });
  } catch {
    return { error: "通行密鑰驗證失敗" as const };
  }
  if (!verified.verified) return { error: "通行密鑰驗證失敗" as const };
  getDb()
    .prepare("UPDATE passkeys SET counter = ? WHERE credential_id = ? AND user_id = ?")
    .run(verified.authenticationInfo.newCounter, row.credential_id, user.id);
  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: new Date(user.created_at).toISOString(),
    },
  };
}
