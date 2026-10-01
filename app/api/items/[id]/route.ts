import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { deleteItem, getItem } from "@/lib/items";
import { getCurrentUser } from "@/lib/users";
import { isUuid } from "@/lib/validators";

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

export async function DELETE(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  const removed = await deleteItem(user.id, id);
  if (!removed) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  return jsonOk({ ok: true });
}
