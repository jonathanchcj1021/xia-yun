import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { getCurrentUser } from "@/lib/users";
import { registrationOptions } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  const options = await registrationOptions(request, user);
  return jsonOk(options);
}
