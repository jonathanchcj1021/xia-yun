import Link from "next/link";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";

const samples = [
  {
    label: "檔案",
    text: "合約、壓縮檔、任何你要在另一台裝置打開的東西。",
  },
  {
    label: "圖片",
    text: "上傳後直接預覽，也可以再下載原檔。",
  },
  {
    label: "筆記",
    text: "一段文字，標題與內文都留在你的帳號裡。",
  },
];

export function Welcome() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-card/80">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Mark className="size-7 text-primary" />
          <span className="text-base font-semibold tracking-tight">匣雲</span>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-12 md:grid-cols-[1.1fr_0.9fr] md:py-20">
        <section>
          <p className="text-sm font-medium text-primary">同一個帳號，許多裝置</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            檔案、圖片與筆記，放在匣雲裡。
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            用手機或電腦的瀏覽器登入。上傳的內容只屬於這個帳號，不會分享給其他人。這個版本先提供網頁；之後的
            App 會呼叫同一支 API。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 px-5">
              <Link href="/register">建立帳號</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-5">
              <Link href="/login">登入</Link>
            </Button>
          </div>
          <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground">
            登入可以用電子郵件與密碼，或用已註冊的通行密鑰。原生 App 之後用同一支 API 與 Bearer token。
          </p>
        </section>
        <aside className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <p className="text-sm font-medium">登入之後可以做這些事</p>
          <ul className="mt-4 flex flex-col gap-3">
            {samples.map((sample) => (
              <li
                key={sample.label}
                className="rounded-xl bg-background px-4 py-3 ring-1 ring-foreground/10"
              >
                <p className="text-sm font-medium">{sample.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {sample.text}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
