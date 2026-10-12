import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { r2ObjectStore } from "@/lib/db";
import { cryptoErrorResponse, isRecord, jsonError, jsonOk, readJson } from "@/lib/http";
import { hasItem } from "@/lib/items";
import { beginUpload } from "@/lib/upload-session";
import { describeUpload } from "@/lib/upload-request";
import { getCurrentUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const parsed = await readJson(request);
  if ("invalid" in parsed || !isRecord(parsed.value)) {
    return jsonError(400, "VALIDATION", "請提供 JSON 內容");
  }
  const described = describeUpload(parsed.value);
  if ("error" in described) {
    return jsonError(400, "VALIDATION", described.error ?? "請檢查上傳內容");
  }
  try {
    const store = await r2ObjectStore();
    const started = await beginUpload(
      store,
      {
        uploadId: randomUUID(),
        itemId: randomUUID(),
        userId: user.id,
        name: described.name,
        type: described.type,
        mimeType: described.mimeType,
        size: described.size,
        group: described.group,
        tags: described.tags,
        now: Date.now(),
      },
      (itemId) => hasItem(user.id, itemId),
    );
    if ("status" in started) return jsonError(started.status, started.code, started.message);
    return jsonOk(
      {
        uploadId: started.meta.uploadId,
        partSize: started.meta.partSize,
        partCount: started.meta.partCount,
      },
      201,
    );
  } catch (error) {
    return cryptoErrorResponse(error) ?? jsonError(500, "UNAVAILABLE", "暫時無法儲存內容");
  }
}
