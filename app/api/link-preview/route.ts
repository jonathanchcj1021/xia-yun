import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { fetchLinkPreview } from "@/lib/link-preview";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  const result = await fetchLinkPreview(raw);
  if ("error" in result) return jsonError(400, "VALIDATION", result.error);
  return jsonOk({ preview: result.preview });
}
