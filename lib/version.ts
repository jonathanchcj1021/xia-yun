const SHA = /^[0-9a-f]{7,40}$/;

/** First 7 hex chars of the deploy commit. Anything else, including a missing CI sha, is dev. */
export function shortVersion(raw: string | undefined | null): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (!SHA.test(value)) return "dev";
  return value.slice(0, 7);
}

export function appVersion(): string {
  return shortVersion(process.env.NEXT_PUBLIC_APP_SHA);
}
