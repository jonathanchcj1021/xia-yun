"use client";

import { useSyncExternalStore } from "react";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/lib/locale";

function readLocale(): Locale {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return parseLocale(match?.[1] ? decodeURIComponent(match[1]) : null);
}

export function useClientLocale(): Locale {
  return useSyncExternalStore(
    () => () => {},
    readLocale,
    () => "zh-Hant",
  );
}
