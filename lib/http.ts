import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ErrorCode } from "@/lib/constants";
import { FieldCryptoError } from "@/lib/field-crypto";

export function cryptoErrorResponse(error: unknown) {
  if (!(error instanceof FieldCryptoError)) return null;
  return jsonError(500, "UNAVAILABLE", "暫時無法處理內容");
}

export function jsonError(status: number, code: ErrorCode, error: string) {
  return NextResponse.json(
    { error, code },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export function jsonOk<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function isHttps(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim().toLowerCase();
    if (first === "https") return true;
    if (first === "http") return false;
  }
  return request.nextUrl.protocol === "https:";
}

export async function readCappedBytes(request: NextRequest, maxBytes: number) {
  const header = request.headers.get("content-length");
  if (header != null && header !== "") {
    const declared = Number(header);
    if (!Number.isFinite(declared) || declared < 0) return { error: "invalid-length" as const };
    if (declared > maxBytes) return { error: "too-large" as const };
  }
  const stream = request.body;
  if (!stream) {
    try {
      const buffered = await request.arrayBuffer();
      if (buffered.byteLength > maxBytes) return { error: "too-large" as const };
      return { bytes: new Uint8Array(buffered) };
    } catch {
      return { error: "unreadable" as const };
    }
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { error: "too-large" as const };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "unreadable" as const };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes };
}

export async function readJson(request: NextRequest) {
  try {
    return { value: (await request.json()) as unknown };
  } catch {
    return { value: null, invalid: true as const };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function contentDisposition(
  kind: "inline" | "attachment",
  filename: string,
) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
