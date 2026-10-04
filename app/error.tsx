"use client";

import { Button } from "@/components/ui/button";
import { useClientLocale } from "@/lib/client-locale";
import { messages } from "@/lib/messages";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = messages[useClientLocale()];
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.pageErrorTitle}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.pageErrorBody}</p>
      <Button className="mt-6 h-11 w-fit" onClick={() => reset()}>
        {copy.retry}
      </Button>
    </main>
  );
}
