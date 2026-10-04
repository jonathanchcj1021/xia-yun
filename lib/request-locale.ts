import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";

export async function requestLocale() {
  const jar = await cookies();
  return parseLocale(jar.get(LOCALE_COOKIE)?.value);
}
