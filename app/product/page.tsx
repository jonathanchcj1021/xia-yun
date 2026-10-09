import type { Metadata } from "next";
import { Welcome } from "@/components/welcome";
import { messages } from "@/lib/messages";
import { requestLocale } from "@/lib/request-locale";
import { getCurrentUser } from "@/lib/users";

export async function generateMetadata(): Promise<Metadata> {
  const copy = messages[await requestLocale()];
  return {
    title: copy.brand,
    description: copy.lead,
  };
}

export const dynamic = "force-dynamic";

export default async function ProductPage() {
  const locale = await requestLocale();
  const user = await getCurrentUser();
  return <Welcome locale={locale} signedIn={Boolean(user)} />;
}
