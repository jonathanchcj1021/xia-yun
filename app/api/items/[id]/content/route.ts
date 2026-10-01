import type { NextRequest } from "next/server";
import { contentDisposition, jsonError } from "@/lib/http";
import { getItem, readBlob } from "@/lib/items";
import { getCurrentUser } from "@/lib/users";
import { isUuid } from "@/lib/validators";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  const item = await getItem(user.id, id);
  if (!item) return jsonError(404, "NOT_FOUND", "找不到這個項目");

  const forceAttachment =
    request.nextUrl.searchParams.get("disposition") === "attachment";
  const disposition = contentDisposition(
    !forceAttachment && item.type === "image" ? "inline" : "attachment",
    item.type === "text" && !item.name.toLowerCase().endsWith(".txt")
      ? `${item.name}.txt`
      : item.name,
  );

  const headers = {
    "Content-Type":
      item.type === "text"
        ? "text/plain; charset=utf-8"
        : (item.mimeType ?? "application/octet-stream"),
    "Content-Disposition": disposition,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  };

  if (item.type === "text") {
    return new Response(item.body ?? "", { status: 200, headers });
  }

  try {
    const bytes = await readBlob(user.id, item.id);
    return new Response(new Uint8Array(bytes), { status: 200, headers });
  } catch {
    return jsonError(404, "NOT_FOUND", "找不到檔案內容");
  }
}
