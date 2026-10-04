import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/locale";
import { messages } from "@/lib/messages";

export function Welcome({ locale }: { locale: Locale }) {
  const copy = messages[locale];
  const samples = [
    { label: copy.sampleFile, text: copy.sampleFileText },
    { label: copy.sampleImage, text: copy.sampleImageText },
    { label: copy.sampleNote, text: copy.sampleNoteText },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-card/80">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <Mark className="size-7 text-primary" />
            <span className="text-base font-semibold tracking-tight">{copy.brand}</span>
          </div>
          <LanguageSwitcher locale={locale} />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-12 md:grid-cols-[1.1fr_0.9fr] md:py-20">
        <section>
          <p className="text-sm font-medium text-primary">{copy.eyebrow}</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {copy.headline}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{copy.lead}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 px-5">
              <Link href="/register">{copy.createAccount}</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-5">
              <Link href="/login">{copy.login}</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-5">
              <Link href="/download">{copy.downloadApp}</Link>
            </Button>
          </div>
          <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground">{copy.loginNote}</p>
        </section>
        <aside className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <p className="text-sm font-medium">{copy.afterLogin}</p>
          <ul className="mt-4 flex flex-col gap-3">
            {samples.map((sample) => (
              <li
                key={sample.label}
                className="rounded-xl bg-background px-4 py-3 ring-1 ring-foreground/10"
              >
                <p className="text-sm font-medium">{sample.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{sample.text}</p>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
