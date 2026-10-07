import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FilesExplorer } from "@/components/files-explorer";
import { messages } from "@/lib/messages";
import { requestLocale } from "@/lib/request-locale";
import { getCurrentUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const copy = messages[await requestLocale()];
  return { title: `${copy.filesTitle} · ${copy.brand}` };
}

export default async function FilesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await requestLocale();
  return <FilesExplorer userEmail={user.email} locale={locale} />;
}
