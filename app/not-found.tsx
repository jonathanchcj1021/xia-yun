import Link from "next/link";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages";
import { requestLocale } from "@/lib/request-locale";

export default async function NotFound() {
  const copy = messages[await requestLocale()];
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.notFoundTitle}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.notFoundBody}</p>
      <Button asChild className="mt-6 h-11 w-fit">
        <Link href="/">{copy.backHome}</Link>
      </Button>
    </main>
  );
}
