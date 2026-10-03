import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apkKey = "download/xia-yun.apk";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const object = await env.BLOBS.get(apkKey);
  if (!object) {
    return new Response("找不到安裝檔", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const size = object.size;
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(size),
      "Content-Disposition": 'attachment; filename="xia-yun.apk"',
      "Cache-Control": "no-store",
    },
  });
}
