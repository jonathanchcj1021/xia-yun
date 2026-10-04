import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, localeCookie, parseLocale, type Locale } from "@/lib/locale";
import { messages } from "@/lib/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(locale: Locale) {
  const copy = messages[locale];
  const links = (["zh-Hant", "zh-Hans", "en"] as const)
    .map((item) => {
      const label = item === "zh-Hant" ? copy.langZhHant : item === "zh-Hans" ? copy.langZhHans : copy.langEn;
      const current = item === locale ? ' aria-current="true"' : "";
      return `<a class="lang" href="/download?lang=${item}"${current}>${escapeHtml(label)}</a>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(copy.downloadTitle)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f6f1e6;
      color: #3a2c24;
      font-family: "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
    }
    main { width: min(100%, 28rem); padding: 2rem 1.25rem; }
    h1 { margin: 0.75rem 0 0.5rem; font-size: 2.25rem; letter-spacing: -0.03em; }
    .lead { margin: 0 0 1.25rem; line-height: 1.6; color: #7a685c; }
    a.download {
      display: inline-block;
      background: #8c3a2a;
      color: #fff8f2;
      text-decoration: none;
      font-weight: 650;
      padding: 0.9rem 1.5rem;
      border-radius: 999px;
    }
    p.hint { margin: 1.25rem 0 0; line-height: 1.6; color: #7a685c; }
    nav { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    a.lang {
      color: #3a2c24;
      text-decoration: none;
      border: 1px solid #d8c8b8;
      border-radius: 999px;
      padding: 0.25rem 0.7rem;
      font-size: 0.85rem;
    }
    a.lang[aria-current="true"] { background: #3a2c24; color: #fff8f2; border-color: #3a2c24; }
  </style>
</head>
<body>
  <main>
    <nav aria-label="${escapeHtml(copy.langLabel)}">${links}</nav>
    <h1>${escapeHtml(copy.brand)}</h1>
    <p class="lead">${escapeHtml(copy.downloadLead)}</p>
    <a class="download" href="/download/apk" download>${escapeHtml(copy.downloadAction)}</a>
    <p class="hint">${escapeHtml(copy.downloadHint)}</p>
  </main>
</body>
</html>`;
}

export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("lang");
  const locale = parseLocale(query ?? request.cookies.get(LOCALE_COOKIE)?.value);
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  if (query === "zh-Hant" || query === "zh-Hans" || query === "en") {
    headers.set("Set-Cookie", localeCookie(locale));
  }
  return new Response(page(locale), { headers });
}
