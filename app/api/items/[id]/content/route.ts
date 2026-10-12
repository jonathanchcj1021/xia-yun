import type { NextRequest } from "next/server";
import { contentDisposition, cryptoErrorResponse, jsonError } from "@/lib/http";
import { dataEncryptionKey } from "@/lib/field-crypto";
import { openPlaintext } from "@/lib/chunk-crypto";
import { openBlob } from "@/lib/db";
import { getItem } from "@/lib/items";
import { getCurrentUser } from "@/lib/users";
import { isUuid } from "@/lib/validators";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError(404, "NOT_FOUND", "找不到這個項目");
  let item;
  try {
    item = await getItem(user.id, id);
  } catch (error) {
    return cryptoErrorResponse(error) ?? jsonError(500, "UNAVAILABLE", "暫時無法讀取內容");
  }
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
    const opened = await openBlob(user.id, item.id);
    if (!opened) return jsonError(404, "NOT_FOUND", "找不到檔案內容");
    const plain = await openPlaintext(opened.stream, opened.size, await dataEncryptionKey());
    const body = plain.kind === "bytes" ? new Uint8Array(plain.bytes) : plain.stream;
    return new Response(body, {
      status: 200,
      headers: { ...headers, "Content-Length": String(item.size) },
    });
  } catch (error) {
    return cryptoErrorResponse(error) ?? jsonError(404, "NOT_FOUND", "找不到檔案內容");
  }
}
