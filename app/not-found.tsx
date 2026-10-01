import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">找不到這個頁面</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        這個網址沒有對應的頁面。回到匣雲首頁繼續。
      </p>
      <Button asChild className="mt-6 h-11 w-fit">
        <Link href="/">回到首頁</Link>
      </Button>
    </main>
  );
}
