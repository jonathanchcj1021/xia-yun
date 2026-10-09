import type { NextRequest } from "next/server";
import { isRecord, jsonError, jsonOk, readJson } from "@/lib/http";
import { deleteItems } from "@/lib/items";
import { getCurrentUser } from "@/lib/users";
import { isUuid } from "@/lib/validators";

export const runtime = "nodejs";

const MAX_BULK_DELETE = 200;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const parsed = await readJson(request);
  if ("invalid" in parsed || !isRecord(parsed.value) || !Array.isArray(parsed.value.ids)) {
    return jsonError(400, "VALIDATION", "請提供要刪除的檔案");
  }
  const ids = parsed.value.ids;
  if (ids.length === 0) return jsonError(400, "VALIDATION", "請提供要刪除的檔案");
  if (ids.length > MAX_BULK_DELETE) {
    return jsonError(400, "VALIDATION", "一次最多刪除 200 個檔案");
  }
  if (!ids.every((id) => typeof id === "string" && isUuid(id))) {
    return jsonError(400, "VALIDATION", "請提供要刪除的檔案");
  }
  const deleted = await deleteItems(user.id, ids);
  return jsonOk({ deleted });
}
