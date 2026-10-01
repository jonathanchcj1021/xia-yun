import { jsonError, jsonOk } from "@/lib/http";
import { getCurrentUser } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError(401, "UNAUTHENTICATED", "尚未登入");
  }
  return jsonOk({ user });
}
