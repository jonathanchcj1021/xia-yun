"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALES, localeCookie, type Locale } from "@/lib/locale";
import { messages } from "@/lib/messages";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const copy = messages[locale];
  const labels: Record<Locale, string> = {
    "zh-Hant": copy.langZhHant,
    "zh-Hans": copy.langZhHans,
    en: copy.langEn,
  };

  function choose(next: Locale) {
    document.cookie = localeCookie(next);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={copy.langLabel}>
      {LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => choose(item)}
          aria-pressed={item === locale}
          className={`rounded-full px-2.5 py-1 text-xs ${
            item === locale ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {labels[item]}
        </button>
      ))}
      <span className="sr-only">{LOCALE_COOKIE}</span>
    </div>
  );
}
