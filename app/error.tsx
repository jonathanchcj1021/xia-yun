"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">頁面暫時無法顯示</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        匣雲遇到沒有預期的問題。再試一次，或重新整理瀏覽器。
      </p>
      <Button className="mt-6 h-11 w-fit" onClick={() => reset()}>
        再試一次
      </Button>
    </main>
  );
}
