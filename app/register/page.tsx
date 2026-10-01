import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/users";

export const metadata: Metadata = {
  title: "建立帳號 · 匣雲",
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="register" />;
}
