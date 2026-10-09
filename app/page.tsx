import type { Metadata } from "next";
import { LibraryApp } from "@/components/library-app";
import { Welcome } from "@/components/welcome";
import { requestLocale } from "@/lib/request-locale";
import { messages } from "@/lib/messages";
import { getCurrentUser } from "@/lib/users";

export async function generateMetadata(): Promise<Metadata> {
  const copy = messages[await requestLocale()];
  return {
    title: copy.brand,
    description: copy.lead,
  };
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await requestLocale();
  const user = await getCurrentUser();
  if (!user) return <Welcome locale={locale} />;
  return <LibraryApp user={user} locale={locale} />;
}
