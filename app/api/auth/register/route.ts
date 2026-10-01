import type { NextRequest } from "next/server";
import { jsonError, jsonOk, readJson, isRecord } from "@/lib/http";
import { normalizeEmail, normalizePassword } from "@/lib/validators";
import { createSession, registerUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = await readJson(request);
  if ("invalid" in parsed || !isRecord(parsed.value)) {
    return jsonError(400, "VALIDATION", "請提供 JSON 內容");
  }
  const email = normalizeEmail(parsed.value.email);
  if (!email) {
    return jsonError(400, "VALIDATION", "請輸入有效的電子郵件");
  }
  const password = normalizePassword(parsed.value.password);
  if ("error" in password) {
    return jsonError(400, "VALIDATION", password.error ?? "請檢查密碼");
  }

  const created = await registerUser(email, password.password);
  if ("taken" in created) {
    return jsonError(409, "EMAIL_TAKEN", "這個電子郵件已經註冊");
  }
  await createSession(request, created.user.id);
  return jsonOk({ user: created.user }, 201);
}
