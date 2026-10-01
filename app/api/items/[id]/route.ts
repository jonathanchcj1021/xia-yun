import type { NextRequest } from "next/server";
import { isRecord, jsonError, jsonOk, readJson } from "@/lib/http";
import { deleteItem, getItem, updateItemMeta } from "@/lib/items";
import { getCurrentUser } from "@/lib/users";
import { isUuid, normalizeGroup, normalizeTags } from "@/lib/validators";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  const item = getItem(user.id, id);
  if (!item) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  return jsonOk({ item });
}

export async function PATCH(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  const parsed = await readJson(request);
  if ("invalid" in parsed || !isRecord(parsed.value)) {
    return jsonError(400, "VALIDATION", "請提供 JSON 內容");
  }
  const patch: { group?: string | null; tags?: string[] } = {};
  if ("group" in parsed.value) {
    const group = normalizeGroup(parsed.value.group);
    if ("error" in group) return jsonError(400, "VALIDATION", group.error ?? "分組格式不正確");
    patch.group = group.group;
  }
  if ("tags" in parsed.value) {
    const tags = normalizeTags(parsed.value.tags);
    if ("error" in tags) return jsonError(400, "VALIDATION", tags.error ?? "標籤格式不正確");
    patch.tags = tags.tags;
  }
  const item = updateItemMeta(user.id, id, patch);
  if (!item) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  return jsonOk({ item });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  const removed = await deleteItem(user.id, id);
  if (!removed) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  return jsonOk({ ok: true });
}
