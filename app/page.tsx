import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/users";
import { LibraryApp } from "@/components/library-app";
import { Welcome } from "@/components/welcome";

export const metadata: Metadata = {
  title: "匣雲",
  description: "同一個帳號裡的檔案、圖片與文字筆記。",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <Welcome />;
  return <LibraryApp user={user} />;
}
