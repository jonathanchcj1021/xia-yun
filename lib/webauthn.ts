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
import { execute, queryAll, queryOne } from "@/lib/db";
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
  rp_id: string | null;
};

const NO_PASSKEY_ON_THIS_SITE =
  "這個帳號在這個網站還沒有通行密鑰。請先用密碼登入，再按「註冊通行密鑰」。" as const;

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

async function saveChallenge(input: {
  userId?: string | null;
  email?: string | null;
  purpose: ChallengePurpose;
  challenge: string;
}) {
  const now = Date.now();
  await execute(
    `DELETE FROM webauthn_challenges
     WHERE purpose = ?
       AND (
         (? IS NOT NULL AND user_id = ?)
         OR (? IS NOT NULL AND email = ?)
         OR expires_at <= ?
       )`,
    input.purpose,
    input.userId ?? null,
    input.userId ?? null,
    input.email ?? null,
    input.email ?? null,
    now,
  );
  await execute(
    `INSERT INTO webauthn_challenges
      (id, user_id, email, purpose, challenge, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    randomUUID(),
    input.userId ?? null,
    input.email ?? null,
    input.purpose,
    input.challenge,
    now + WEBAUTHN_CHALLENGE_MS,
  );
}

async function takeChallenge(input: {
  userId?: string | null;
  email?: string | null;
  purpose: ChallengePurpose;
}) {
  const now = Date.now();
  const row = await queryOne<{ id: string; challenge: string }>(
    `SELECT id, challenge FROM webauthn_challenges
     WHERE purpose = ?
       AND (? IS NULL OR user_id = ?)
       AND (? IS NULL OR email = ?)
       AND expires_at > ?
     ORDER BY expires_at DESC
     LIMIT 1`,
    input.purpose,
    input.userId ?? null,
    input.userId ?? null,
    input.email ?? null,
    input.email ?? null,
    now,
  );
  if (!row) return null;
  await execute("DELETE FROM webauthn_challenges WHERE id = ?", row.id);
  return row.challenge;
}

async function listPasskeys(userId: string, rpID: string) {
  return queryAll<PasskeyRow>(
    `SELECT credential_id, user_id, public_key, counter, transports, device_type, backed_up, rp_id
     FROM passkeys WHERE user_id = ? AND rp_id = ?`,
    userId,
    rpID,
  );
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
  const existing = await listPasskeys(user.id, rpID);
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
  await saveChallenge({
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
  const expectedChallenge = await takeChallenge({ userId, purpose: "register" });
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
  await execute(
    `INSERT INTO passkeys
      (credential_id, user_id, public_key, counter, transports, device_type, backed_up, created_at, rp_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    credential.id,
    userId,
    isoBase64URL.fromBuffer(credential.publicKey),
    credential.counter,
    credential.transports ? JSON.stringify(credential.transports) : null,
    verified.registrationInfo.credentialDeviceType,
    verified.registrationInfo.credentialBackedUp ? 1 : 0,
    Date.now(),
    rpID,
  );
  return { ok: true as const };
}

export async function loginOptions(request: NextRequest, email: string) {
  const user = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = ?", email);
  const { rpID } = webAuthnContext(request);
  const passkeys = user ? await listPasskeys(user.id, rpID) : [];
  if (!user || passkeys.length === 0) {
    return { error: NO_PASSKEY_ON_THIS_SITE };
  }
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((row) => ({
      id: row.credential_id,
      transports: parseTransports(row.transports),
    })),
    userVerification: "preferred",
  });
  await saveChallenge({ email, purpose: "login", challenge: options.challenge });
  return { options };
}

export async function verifyLogin(
  request: NextRequest,
  email: string,
  response: AuthenticationResponseJSON,
) {
  const expectedChallenge = await takeChallenge({ email, purpose: "login" });
  if (!expectedChallenge) return { error: "通行密鑰挑戰已過期，請再試一次" as const };
  const user = await queryOne<{ id: string; email: string; created_at: number }>(
    "SELECT id, email, created_at FROM users WHERE email = ?",
    email,
  );
  if (!user) return { error: "通行密鑰驗證失敗" as const };
  const { rpID, origin } = webAuthnContext(request);
  const row = (await listPasskeys(user.id, rpID)).find((item) => item.credential_id === response.id);
  if (!row) return { error: NO_PASSKEY_ON_THIS_SITE };
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
  await execute(
    "UPDATE passkeys SET counter = ? WHERE credential_id = ? AND user_id = ?",
    verified.authenticationInfo.newCounter,
    row.credential_id,
    user.id,
  );
  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: new Date(user.created_at).toISOString(),
    },
  };
}
