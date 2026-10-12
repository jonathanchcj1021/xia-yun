import { jsonOk } from "@/lib/http";
import { appVersion } from "@/lib/version";

export const runtime = "nodejs";

export function GET() {
  return jsonOk({ version: appVersion() });
}
