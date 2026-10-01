"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register";

function passkeyBrowserMessage(error: unknown) {
  if (error instanceof Error && error.name === "NotAllowedError") {
    return "通行密鑰已取消，或這台裝置拒絕了要求。";
  }
  if (error instanceof Error && error.name === "InvalidStateError") {
    return "這支通行密鑰已經註冊過。";
  }
  if (error instanceof Error && error.name === "SecurityError") {
    return "這個網址不能使用通行密鑰。請改用 localhost 或網域名稱。";
  }
  return "通行密鑰沒有完成。";
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

async function errorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error) return data.error;
  } catch {
    /* ignore malformed bodies */
  }
  return "伺服器沒有完成這個請求";
}

export function AuthForm({ mode }: { mode: Mode }) {
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
      setError("兩次輸入的密碼不一樣");
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
        setError(await errorMessage(response));
        setPending(false);
        return;
      }
      router.refresh();
      router.push("/");
    } catch {
      setError("無法連線，請稍後再試");
      setPending(false);
    }
  }

  async function loginWithPasskey() {
    setError(null);
    if (!email.trim()) {
      setError("請先輸入電子郵件");
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
        setError(await errorMessage(optionsResponse));
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
        setError(await errorMessage(verifyResponse));
        setPasskeyPending(false);
        return;
      }
      router.refresh();
      router.push("/");
    } catch (caught) {
      setError(passkeyBrowserMessage(caught));
      setPasskeyPending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-card/80">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <Mark className="size-7 text-primary" />
            <span className="text-base font-semibold tracking-tight">匣雲</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isRegister ? "建立匣雲帳號" : "登入匣雲"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isRegister
            ? "用這個電子郵件在手機與電腦瀏覽器登入。密碼至少 8 個字元。"
            : "輸入註冊時的電子郵件與密碼。登入狀態會留在這台裝置。"}
        </p>
        <form
          method="post"
          onSubmit={onSubmit}
          className="mt-8 flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">電子郵件</Label>
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
            <Label htmlFor="password">密碼</Label>
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
              <Label htmlFor="confirm">再輸入一次密碼</Label>
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
                ? "建立中…"
                : "登入中…"
              : isRegister
                ? "建立帳號"
                : "登入"}
          </Button>
          {isRegister ? null : (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={!ready || pending || passkeyPending}
              onClick={() => void loginWithPasskey()}
            >
              {passkeyPending ? "等待裝置確認…" : "用通行密鑰登入"}
            </Button>
          )}
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          {isRegister ? (
            <>
              已經有帳號了？{" "}
              <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                登入
              </Link>
            </>
          ) : (
            <>
              還沒有帳號？{" "}
              <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
                建立帳號
              </Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
