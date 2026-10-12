import type { NextRequest } from "next/server";
import { r2ObjectStore } from "@/lib/db";
import { cryptoErrorResponse, jsonError, jsonOk } from "@/lib/http";
import { cancelUpload } from "@/lib/upload-session";
import { getCurrentUser } from "@/lib/users";
import { isUuid } from "@/lib/validators";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個上傳");
  try {
    const store = await r2ObjectStore();
    const cancelled = await cancelUpload(store, user.id, id);
    if ("status" in cancelled) return jsonError(cancelled.status, cancelled.code, cancelled.message);
    return jsonOk({ ok: true });
  } catch (error) {
    return cryptoErrorResponse(error) ?? jsonError(500, "UNAVAILABLE", "暫時無法儲存內容");
  }
}
