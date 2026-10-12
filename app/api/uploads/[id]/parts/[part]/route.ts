import type { NextRequest } from "next/server";
import { UPLOAD_PART_BYTES } from "@/lib/constants";
import { r2ObjectStore } from "@/lib/db";
import { cryptoErrorResponse, jsonError, jsonOk, readCappedBytes } from "@/lib/http";
import { PART_LENGTH, writePart } from "@/lib/upload-session";
import { getCurrentUser } from "@/lib/users";
import { isUuid } from "@/lib/validators";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; part: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id, part } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個上傳");
  const partNumber = Number(part);
  if (!Number.isSafeInteger(partNumber)) return jsonError(400, "VALIDATION", PART_LENGTH);
  const capped = await readCappedBytes(request, UPLOAD_PART_BYTES);
  if ("error" in capped) {
    if (capped.error === "too-large") return jsonError(400, "VALIDATION", PART_LENGTH);
    if (capped.error === "invalid-length") {
      return jsonError(411, "VALIDATION", "上傳請求需要 Content-Length");
    }
    return jsonError(400, "VALIDATION", "無法讀取上傳內容");
  }
  try {
    const store = await r2ObjectStore();
    const written = await writePart(store, user.id, id, partNumber, capped.bytes);
    if ("status" in written) return jsonError(written.status, written.code, written.message);
    return jsonOk({ partNumber });
  } catch (error) {
    return cryptoErrorResponse(error) ?? jsonError(500, "UNAVAILABLE", "暫時無法儲存內容");
  }
}
