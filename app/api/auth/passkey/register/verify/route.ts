import type { NextRequest } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { isRecord, jsonError, jsonOk, readJson } from "@/lib/http";
import { getCurrentUser } from "@/lib/users";
import { verifyRegistration } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const parsed = await readJson(request);
  if ("invalid" in parsed || !isRegistrationResponse(parsed.value)) {
    return jsonError(400, "VALIDATION", "請提供通行密鑰註冊結果");
  }
  const result = await verifyRegistration(
    request,
    user.id,
    parsed.value as RegistrationResponseJSON,
  );
  if ("error" in result) {
    return jsonError(400, "WEBAUTHN", result.error ?? "通行密鑰驗證失敗");
  }
  return jsonOk({ ok: true });
}

function isRegistrationResponse(value: unknown) {
  return isRecord(value) && typeof value.id === "string" && isRecord(value.response);
}
