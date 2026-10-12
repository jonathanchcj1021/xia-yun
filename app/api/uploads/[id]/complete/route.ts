import type { NextRequest } from "next/server";
import { deleteBlob, r2ObjectStore } from "@/lib/db";
import { cryptoErrorResponse, jsonError, jsonOk } from "@/lib/http";
import { insertBlobItem } from "@/lib/items";
import { discardStaging, finishUpload } from "@/lib/upload-session";
import { getCurrentUser } from "@/lib/users";
import { isUuid } from "@/lib/validators";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個上傳");
  try {
    const store = await r2ObjectStore();
    const finished = await finishUpload(store, user.id, id);
    if ("status" in finished) return jsonError(finished.status, finished.code, finished.message);
    try {
      const item = await insertBlobItem({
        id: finished.meta.itemId,
        userId: user.id,
        type: finished.meta.type,
        name: finished.meta.name,
        mimeType: finished.meta.mimeType,
        size: finished.meta.size,
        group: finished.meta.group,
        tags: finished.meta.tags,
      });
      await discardStaging(store, finished.meta);
      return jsonOk({ item }, 201);
    } catch (error) {
      await deleteBlob(user.id, finished.meta.itemId).catch(() => undefined);
      await discardStaging(store, finished.meta).catch(() => undefined);
      return cryptoErrorResponse(error) ?? jsonError(500, "UNAVAILABLE", "暫時無法儲存內容");
    }
  } catch (error) {
    return cryptoErrorResponse(error) ?? jsonError(500, "UNAVAILABLE", "暫時無法儲存內容");
  }
}
