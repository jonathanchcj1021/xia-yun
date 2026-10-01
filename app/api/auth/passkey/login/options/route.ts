import type { NextRequest } from "next/server";
import { isRecord, jsonError, jsonOk, readJson } from "@/lib/http";
import { normalizeEmail } from "@/lib/validators";
import { loginOptions } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = await readJson(request);
  if ("invalid" in parsed || !isRecord(parsed.value)) {
    return jsonError(400, "VALIDATION", "請提供 JSON 內容");
  }
  const email = normalizeEmail(parsed.value.email);
  if (!email) return jsonError(400, "VALIDATION", "請輸入有效的電子郵件");
  const result = await loginOptions(request, email);
  if ("error" in result) {
    return jsonError(
      400,
      "WEBAUTHN",
      result.error ?? "這個帳號在這個網站還沒有通行密鑰。請先用密碼登入，再按「註冊通行密鑰」。",
    );
  }
  return jsonOk(result.options);
}
