"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register";

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
          <Button type="submit" className="h-11" disabled={!ready || pending}>
            {pending
              ? isRegister
                ? "建立中…"
                : "登入中…"
              : isRegister
                ? "建立帳號"
                : "登入"}
          </Button>
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
