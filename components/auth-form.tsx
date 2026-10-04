"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localizePhrase } from "@/lib/known-phrases";
import type { Locale } from "@/lib/locale";
import { messages } from "@/lib/messages";

type Mode = "login" | "register";

function passkeyBrowserMessage(error: unknown, copy: (typeof messages)["zh-Hant"]) {
  if (error instanceof Error && error.name === "NotAllowedError") return copy.passkeyCancelled;
  if (error instanceof Error && error.name === "InvalidStateError") return copy.passkeyDuplicate;
  if (error instanceof Error && error.name === "SecurityError") return copy.passkeyOrigin;
  return copy.passkeyFailed;
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

async function errorMessage(response: Response, fallback: string, locale: Locale) {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error) return localizePhrase(data.error, locale);
  } catch {
    /* ignore malformed bodies */
  }
  return fallback;
}

export function AuthForm({ mode, locale }: { mode: Mode; locale: Locale }) {
  const copy = messages[locale];
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const ready = useHydrated();
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (isRegister && password !== confirm) {
      setError(copy.passwordMismatch);
      return;
    }
    setPending(true);
    try {
      const response = await fetch(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      if (!response.ok) {
        setError(await errorMessage(response, copy.requestFailed, locale));
        setPending(false);
        return;
      }
      router.refresh();
      router.push("/");
    } catch {
      setError(copy.network);
      setPending(false);
    }
  }

  async function loginWithPasskey() {
    setError(null);
    if (!email.trim()) {
      setError(copy.emailFirst);
      return;
    }
    setPasskeyPending(true);
    try {
      const optionsResponse = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!optionsResponse.ok) {
        setError(await errorMessage(optionsResponse, copy.requestFailed, locale));
        setPasskeyPending(false);
        return;
      }
      const optionsJSON = await optionsResponse.json();
      const assertion = await startAuthentication({ optionsJSON });
      const verifyResponse = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, response: assertion }),
      });
      if (!verifyResponse.ok) {
        setError(await errorMessage(verifyResponse, copy.requestFailed, locale));
        setPasskeyPending(false);
        return;
      }
      router.refresh();
      router.push("/");
    } catch (caught) {
      setError(passkeyBrowserMessage(caught, copy));
      setPasskeyPending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-card/80">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Mark className="size-7 text-primary" />
            <span className="text-base font-semibold tracking-tight">{copy.brand}</span>
          </Link>
          <LanguageSwitcher locale={locale} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isRegister ? copy.registerTitle : copy.loginTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isRegister ? copy.registerLead : copy.loginLead}
        </p>
        <form
          method="post"
          onSubmit={onSubmit}
          className="mt-8 flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{copy.email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 text-base md:text-sm"
              placeholder="you@example.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{copy.password}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 text-base md:text-sm"
            />
          </div>
          {isRegister ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">{copy.confirmPassword}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="h-11 text-base md:text-sm"
              />
            </div>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-11" disabled={!ready || pending || passkeyPending}>
            {pending
              ? isRegister
                ? copy.creating
                : copy.loggingIn
              : isRegister
                ? copy.submitRegister
                : copy.submitLogin}
          </Button>
          {isRegister ? null : (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={!ready || pending || passkeyPending}
              onClick={() => void loginWithPasskey()}
            >
              {passkeyPending ? copy.passkeyWaiting : copy.passkeyLogin}
            </Button>
          )}
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          {isRegister ? (
            <>
              {copy.haveAccount}{" "}
              <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                {copy.login}
              </Link>
            </>
          ) : (
            <>
              {copy.noAccount}{" "}
              <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
                {copy.createAccount}
              </Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
