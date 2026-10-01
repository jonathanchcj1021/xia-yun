import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http";
import { clearSession } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await clearSession(request);
  return jsonOk({ ok: true });
}
