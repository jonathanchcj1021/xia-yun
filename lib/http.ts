import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ErrorCode } from "@/lib/constants";

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
