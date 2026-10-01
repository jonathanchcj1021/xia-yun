import {
  MAX_EMAIL_LENGTH,
  MAX_ITEM_NAME,
  MAX_NOTE_BODY,
  MAX_NOTE_TITLE,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  RASTER_MIME_TYPES,
  UUID_PATTERN,
} from "@/lib/constants";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    return null;
  }
  return email;
}

export function normalizePassword(value: unknown) {
  if (typeof value !== "string") return { error: "請輸入密碼" as const };
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { error: "密碼至少需要 8 個字元" as const };
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return { error: "密碼最長 128 個字元" as const };
  }
  return { password: value };
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function sanitizeItemName(value: string) {
  const base = value.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim();
  return cleaned.slice(0, MAX_ITEM_NAME);
}

export function normalizeMime(value: string) {
  const base = value.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "image/jpg" || base === "image/pjpeg") return "image/jpeg";
  if (base === "image/x-png") return "image/png";
  return base || "application/octet-stream";
}

export function isRasterMime(mime: string) {
  return RASTER_MIME_TYPES.has(mime);
}

export function normalizeNoteTitle(value: unknown) {
  if (typeof value !== "string") return { error: "請填寫筆記標題" as const };
  const title = value.trim();
  if (!title) return { error: "請填寫筆記標題" as const };
  if (title.length > MAX_NOTE_TITLE) {
    return { error: "筆記標題最長 200 個字元" as const };
  }
  return { title };
}

export function normalizeNoteBody(value: unknown) {
  if (value == null) return { body: "" };
  if (typeof value !== "string") return { error: "筆記內文格式不正確" as const };
  if (value.length > MAX_NOTE_BODY) {
    return { error: "筆記內文最長 10 萬個字元" as const };
  }
  return { body: value };
}
