import type { NextRequest } from "next/server";
import { MAX_REQUEST_BYTES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { jsonError, jsonOk, isRecord, readJson } from "@/lib/http";
import { createBlobItem, createTextItem, listItems } from "@/lib/items";
import { getCurrentUser } from "@/lib/users";
import {
  isRasterMime,
  normalizeMime,
  normalizeNoteBody,
  normalizeNoteTitle,
  sanitizeItemName,
} from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  return jsonOk({ items: listItems(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return createNote(request, user.id);
  }
  if (contentType.includes("multipart/form-data")) {
    return createUpload(request, user.id);
  }
  return jsonError(
    415,
    "UNSUPPORTED_MEDIA",
    "請用 JSON 建立筆記，或用 multipart 上傳檔案",
  );
}

async function createNote(request: NextRequest, userId: string) {
  const parsed = await readJson(request);
  if ("invalid" in parsed || !isRecord(parsed.value)) {
    return jsonError(400, "VALIDATION", "請提供 JSON 內容");
  }
  if (parsed.value.type !== "text") {
    return jsonError(400, "VALIDATION", "JSON 只接受 type 為 text 的筆記");
  }
  const title = normalizeNoteTitle(parsed.value.title);
  if ("error" in title) {
    return jsonError(400, "VALIDATION", title.error ?? "請填寫筆記標題");
  }
  const body = normalizeNoteBody(parsed.value.body);
  if ("error" in body) {
    return jsonError(400, "VALIDATION", body.error ?? "筆記內文格式不正確");
  }
  const item = await createTextItem(userId, title.title, body.body);
  return jsonOk({ item }, 201);
}

async function createUpload(request: NextRequest, userId: string) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declaredLength) || declaredLength < 0) {
    return jsonError(411, "VALIDATION", "上傳請求需要 Content-Length");
  }
  if (declaredLength > MAX_REQUEST_BYTES) {
    return jsonError(413, "PAYLOAD_TOO_LARGE", "檔案超過 32 MB 上限");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "VALIDATION", "無法讀取上傳內容");
  }

  const uploaded = form.get("file");
  if (!(uploaded instanceof File)) {
    return jsonError(400, "VALIDATION", "請選擇要上傳的檔案");
  }
  if (uploaded.size > MAX_UPLOAD_BYTES) {
    return jsonError(413, "PAYLOAD_TOO_LARGE", "檔案超過 32 MB 上限");
  }

  const mimeType = normalizeMime(uploaded.type || "application/octet-stream");
  const hinted = form.get("type");
  let type: "file" | "image";
  if (hinted == null || hinted === "") {
    type = isRasterMime(mimeType) ? "image" : "file";
  } else if (hinted === "file") {
    type = "file";
  } else if (hinted === "image") {
    if (!isRasterMime(mimeType)) {
      return jsonError(400, "VALIDATION", "這個檔案不是可預覽的點陣圖片");
    }
    type = "image";
  } else {
    return jsonError(400, "VALIDATION", "type 只能是 file 或 image");
  }

  if (type === "image" && !isRasterMime(mimeType)) {
    type = "file";
  }

  const nameField = form.get("name");
  const rawName =
    typeof nameField === "string" && nameField.trim()
      ? nameField
      : uploaded.name;
  const name = sanitizeItemName(rawName) || "未命名檔案";
  const bytes = Buffer.from(await uploaded.arrayBuffer());
  const item = await createBlobItem({
    userId,
    type,
    name,
    mimeType,
    bytes,
  });
  return jsonOk({ item }, 201);
}
