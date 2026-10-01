export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
/** Multipart boundary and fields sit on top of the file bytes. */
export const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;
export const BCRYPT_ROUNDS = 12;
export const MAX_EMAIL_LENGTH = 254;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NOTE_TITLE = 200;
export const MAX_NOTE_BODY = 100_000;
export const MAX_ITEM_NAME = 255;

export const RASTER_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
]);

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ItemType = "file" | "image" | "text";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA";
