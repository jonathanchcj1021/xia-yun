import { isRasterMime, normalizeGroup, normalizeMime, normalizeTags, sanitizeItemName } from "@/lib/validators";

export function describeUpload(value: Record<string, unknown>) {
  if (typeof value.size !== "number" || !Number.isSafeInteger(value.size)) {
    return { error: "請選擇要上傳的檔案" };
  }
  const mimeType = normalizeMime(
    typeof value.mimeType === "string" && value.mimeType.trim()
      ? value.mimeType
      : "application/octet-stream",
  );
  const hinted = value.type;
  let type: "file" | "image";
  if (hinted == null || hinted === "") {
    type = isRasterMime(mimeType) ? "image" : "file";
  } else if (hinted === "file") {
    type = "file";
  } else if (hinted === "image") {
    if (!isRasterMime(mimeType)) return { error: "這個檔案不是可預覽的點陣圖片" };
    type = "image";
  } else {
    return { error: "type 只能是 file 或 image" };
  }
  if (type === "image" && !isRasterMime(mimeType)) type = "file";
  const name = sanitizeItemName(typeof value.name === "string" ? value.name : "") || "未命名檔案";
  let group: string | null | undefined;
  if ("group" in value) {
    const parsed = normalizeGroup(value.group);
    if ("error" in parsed) return { error: parsed.error ?? "分組格式不正確" };
    group = parsed.group;
  }
  let tags: string[] | undefined;
  if ("tags" in value) {
    const parsed = normalizeTags(value.tags);
    if ("error" in parsed) return { error: parsed.error ?? "標籤格式不正確" };
    tags = parsed.tags;
  }
  return { name, mimeType, type, size: value.size, group: group ?? null, tags: tags ?? [] };
}
