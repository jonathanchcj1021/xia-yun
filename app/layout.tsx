import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import { messages } from "@/lib/messages";
import { requestLocale } from "@/lib/request-locale";
import "./globals.css";

const noto = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
});

export async function generateMetadata(): Promise<Metadata> {
  const copy = messages[await requestLocale()];
  return {
    title: copy.brand,
    description: copy.lead,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await requestLocale();
  return (
    <html lang={locale} className={`${noto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
