export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const page = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>匣雲</title>
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
    h1 { margin: 0 0 1.25rem; font-size: 2.25rem; letter-spacing: -0.03em; }
    a {
      display: inline-block;
      background: #8c3a2a;
      color: #fff8f2;
      text-decoration: none;
      font-weight: 650;
      padding: 0.9rem 1.5rem;
      border-radius: 999px;
    }
    p { margin: 1.25rem 0 0; line-height: 1.6; color: #7a685c; }
  </style>
</head>
<body>
  <main>
    <h1>匣雲</h1>
    <a href="/download/apk" download>下載匣雲</a>
    <p>安裝前，Android 必須允許安裝未知的應用程式。</p>
  </main>
</body>
</html>
`;

export function GET() {
  return new Response(page, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
