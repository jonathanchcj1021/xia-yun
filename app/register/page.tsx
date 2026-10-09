import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { messages } from "@/lib/messages";
import { requestLocale } from "@/lib/request-locale";
import { getCurrentUser } from "@/lib/users";

export async function generateMetadata(): Promise<Metadata> {
  const copy = messages[await requestLocale()];
  return { title: `${copy.registerTitle} · ${copy.brand}` };
}

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="register" locale={await requestLocale()} />;
}
