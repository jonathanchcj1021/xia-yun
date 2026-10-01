import type { NextRequest } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { isRecord, jsonError, jsonOk, readJson } from "@/lib/http";
import { normalizeEmail } from "@/lib/validators";
import { createSession, nativeClientRequested } from "@/lib/users";
import { verifyLogin } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = await readJson(request);
  if ("invalid" in parsed || !isRecord(parsed.value)) {
    return jsonError(400, "VALIDATION", "請提供 JSON 內容");
  }
  if (parsed.value.client != null && !nativeClientRequested(parsed.value.client)) {
    return jsonError(400, "VALIDATION", "client 只能是 native");
  }
  const email = normalizeEmail(parsed.value.email);
  if (!email) return jsonError(400, "VALIDATION", "請輸入有效的電子郵件");
  if (!isAuthenticationResponse(parsed.value.response)) {
    return jsonError(400, "VALIDATION", "請提供通行密鑰登入結果");
  }
  const result = await verifyLogin(
    request,
    email,
    parsed.value.response as AuthenticationResponseJSON,
  );
  if ("error" in result) {
    return jsonError(400, "WEBAUTHN", result.error ?? "通行密鑰驗證失敗");
  }
  const token = await createSession(request, result.user.id);
  if (nativeClientRequested(parsed.value.client)) {
    return jsonOk({ user: result.user, token });
  }
  return jsonOk({ user: result.user });
}

function isAuthenticationResponse(value: unknown) {
  return isRecord(value) && typeof value.id === "string" && isRecord(value.response);
}
