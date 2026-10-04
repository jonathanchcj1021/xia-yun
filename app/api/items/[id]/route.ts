import type { NextRequest } from "next/server";
import { cryptoErrorResponse, isRecord, jsonError, jsonOk, readJson } from "@/lib/http";
import { deleteItem, getItem, updateItemMeta, updateTextItem } from "@/lib/items";
import { getCurrentUser } from "@/lib/users";
import { isUuid, normalizeGroup, normalizeNoteBody, normalizeNoteTitle, normalizeTags } from "@/lib/validators";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  try {
    const item = await getItem(user.id, id);
    if (!item) return jsonError(404, "NOT_FOUND", "找不到這個項目");
    return jsonOk({ item });
  } catch (error) {
    return cryptoErrorResponse(error) ?? jsonError(500, "UNAVAILABLE", "暫時無法讀取內容");
  }
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
  let textPatch: { title?: string; body?: string } | null = null;
  if ("title" in parsed.value || "body" in parsed.value) {
    textPatch = {};
    if ("title" in parsed.value) {
      const title = normalizeNoteTitle(parsed.value.title);
      if ("error" in title) return jsonError(400, "VALIDATION", title.error ?? "請填寫筆記標題");
      textPatch.title = title.title;
    }
    if ("body" in parsed.value) {
      const body = normalizeNoteBody(parsed.value.body);
      if ("error" in body) return jsonError(400, "VALIDATION", body.error ?? "筆記內文格式不正確");
      textPatch.body = body.body;
    }
  }
  try {
    if (textPatch) {
      const updated = await updateTextItem(user.id, id, textPatch);
      if (!updated) return jsonError(404, "NOT_FOUND", "找不到這個項目");
    }
    const item = await updateItemMeta(user.id, id, patch);
    if (!item) return jsonError(404, "NOT_FOUND", "找不到這個項目");
    return jsonOk({ item });
  } catch (error) {
    return cryptoErrorResponse(error) ?? jsonError(500, "UNAVAILABLE", "暫時無法儲存內容");
  }
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
