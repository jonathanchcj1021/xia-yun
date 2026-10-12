import { MAX_UPLOAD_BYTES, SINGLE_UPLOAD_BYTES, UPLOAD_PART_BYTES } from "@/lib/constants";

export type UploadMode = "single" | "chunked" | "reject";

export function chooseUploadMode(size: number): UploadMode {
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_UPLOAD_BYTES) return "reject";
  if (size <= SINGLE_UPLOAD_BYTES) return "single";
  return "chunked";
}

export function planUpload(size: number, partSize = UPLOAD_PART_BYTES) {
  if (!Number.isSafeInteger(size) || size < 1) return { error: "invalid" as const };
  if (size > MAX_UPLOAD_BYTES) return { error: "too-large" as const };
  if (!Number.isSafeInteger(partSize) || partSize < 1) return { error: "invalid" as const };
  const partCount = Math.ceil(size / partSize);
  return { partSize, partCount };
}

export function partPlainLength(size: number, partSize: number, partNumber: number) {
  if (!Number.isSafeInteger(partNumber) || partNumber < 1) return 0;
  const start = (partNumber - 1) * partSize;
  if (start >= size) return 0;
  return Math.min(partSize, size - start);
}
