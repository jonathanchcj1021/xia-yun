import type { NextRequest } from "next/server";
import { jsonError, jsonOk, readJson, isRecord } from "@/lib/http";
import { normalizeEmail, normalizePassword } from "@/lib/validators";
import { authenticate, createSession, nativeClientRequested } from "@/lib/users";

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
  const password = normalizePassword(parsed.value.password);
  if (!email || "error" in password) {
    return jsonError(401, "INVALID_CREDENTIALS", "電子郵件或密碼不正確");
  }

  const user = await authenticate(email, password.password);
  if (!user) {
    return jsonError(401, "INVALID_CREDENTIALS", "電子郵件或密碼不正確");
  }
  const token = await createSession(request, user.id);
  if (nativeClientRequested(parsed.value.client)) {
    return jsonOk({ user, token });
  }
  return jsonOk({ user });
}
