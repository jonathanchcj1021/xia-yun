"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import {
  Download,
  FileText,
  Fingerprint,
  ImageIcon,
  Loader2,
  LogOut,
  PenLine,
  Trash2,
  Upload,
} from "lucide-react";
import { Mark } from "@/components/mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PublicUser } from "@/lib/types";

type ItemType = "file" | "image" | "text";

type Item = {
  id: string;
  ownerId: string;
  type: ItemType;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
  excerpt: string | null;
  body: string | null;
};

const typeLabel: Record<ItemType, string> = {
  file: "檔案",
  image: "圖片",
  text: "筆記",
};

const timeFormat = new Intl.DateTimeFormat("zh-TW", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const value = bytes / 1024;
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function errorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error) return data.error;
  } catch {
    /* ignore */
  }
  return "伺服器沒有完成這個請求";
}

export function LibraryApp({ user }: { user: PublicUser }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyNotice, setPasskeyNotice] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<Item | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [reading, setReading] = useState<Item | null>(null);
  const [readingState, setReadingState] = useState<"loading" | "ready" | "error">(
    "ready",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const goToLogin = useCallback(() => {
    router.refresh();
    router.push("/login");
  }, [router]);

  const loadItems = useCallback(async () => {
    setListError(null);
    try {
      const response = await fetch("/api/items");
      if (response.status === 401) {
        goToLogin();
        return;
      }
      if (!response.ok) {
        setListError(await errorMessage(response));
        setItems([]);
        return;
      }
      const data = (await response.json()) as { items: Item[] };
      setItems(data.items);
    } catch {
      setListError("無法連線，請稍後再試");
      setItems([]);
    }
  }, [goToLogin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  async function registerPasskey() {
    setPasskeyNotice(null);
    setActionError(null);
    setPasskeyPending(true);
    try {
      const optionsResponse = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      if (optionsResponse.status === 401) {
        goToLogin();
        return;
      }
      if (!optionsResponse.ok) {
        setPasskeyNotice(await errorMessage(optionsResponse));
        setPasskeyPending(false);
        return;
      }
      const optionsJSON = await optionsResponse.json();
      const attestation = await startRegistration({ optionsJSON });
      const verifyResponse = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });
      if (!verifyResponse.ok) {
        setPasskeyNotice(await errorMessage(verifyResponse));
        setPasskeyPending(false);
        return;
      }
      setPasskeyNotice("通行密鑰已註冊。下次可以用它登入這個帳號。");
      setPasskeyPending(false);
    } catch (caught) {
      const name = caught instanceof Error ? caught.name : "";
      setPasskeyNotice(
        name === "NotAllowedError"
          ? "通行密鑰已取消，或這台裝置拒絕了要求。"
          : name === "InvalidStateError"
            ? "這支通行密鑰已經註冊過。"
            : name === "SecurityError"
              ? "這個網址不能使用通行密鑰。請改用 localhost 或網域名稱。"
              : "通行密鑰沒有完成。",
      );
      setPasskeyPending(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.refresh();
      router.push("/");
    }
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || uploading) return;
    setActionError(null);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setUploading(
        files.length > 1
          ? `正在上傳 ${index + 1}/${files.length}：${file.name}`
          : `正在上傳 ${file.name}`,
      );
      const form = new FormData();
      form.set("file", file);
      try {
        const response = await fetch("/api/items", { method: "POST", body: form });
        if (response.status === 401) {
          goToLogin();
          return;
        }
        if (!response.ok) {
          setActionError(await errorMessage(response));
          break;
        }
      } catch {
        setActionError("上傳時無法連線，請稍後再試");
        break;
      }
    }
    setUploading(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await loadItems();
  }

  async function saveNote() {
    setActionError(null);
    setSavingNote(true);
    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          title: noteTitle,
          body: noteBody,
        }),
      });
      if (response.status === 401) {
        goToLogin();
        return;
      }
      if (!response.ok) {
        setActionError(await errorMessage(response));
        setSavingNote(false);
        return;
      }
      setNoteOpen(false);
      setNoteTitle("");
      setNoteBody("");
      setSavingNote(false);
      await loadItems();
    } catch {
      setActionError("儲存筆記時無法連線");
      setSavingNote(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/items/${pendingDelete.id}`, {
        method: "DELETE",
      });
      if (response.status === 401) {
        goToLogin();
        return;
      }
      if (!response.ok) {
        setActionError(await errorMessage(response));
        setDeleting(false);
        return;
      }
      setPendingDelete(null);
      setDeleting(false);
      await loadItems();
    } catch {
      setActionError("刪除時無法連線");
      setDeleting(false);
    }
  }

  async function openNote(item: Item) {
    setReading(item);
    setReadingState("loading");
    try {
      const response = await fetch(`/api/items/${item.id}`);
      if (!response.ok) {
        setReadingState("error");
        return;
      }
      const data = (await response.json()) as { item: Item };
      setReading(data.item);
      setReadingState("ready");
    } catch {
      setReadingState("error");
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Mark className="size-8 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight">匣雲</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => void registerPasskey()}
              disabled={passkeyPending || loggingOut}
            >
              <Fingerprint />
              {passkeyPending ? "等待裝置確認…" : "註冊通行密鑰"}
            </Button>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => void logout()}
              disabled={loggingOut || passkeyPending}
            >
              <LogOut />
              {loggingOut ? "登出中…" : "登出"}
            </Button>
          </div>
        </div>
        {passkeyNotice ? (
          <p role="status" className="px-4 pb-3 text-sm text-muted-foreground">
            {passkeyNotice}
          </p>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div
            className={`flex flex-1 flex-col items-start gap-3 rounded-2xl border border-dashed px-4 py-5 transition-colors sm:px-6 ${
              dragging ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void uploadFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Upload className="size-4 text-primary" />
              把檔案拖到這裡
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              點陣圖片會顯示預覽。單一檔案上限 32 MB。一次可以拖入多個檔案。
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={(event) => {
                void uploadFiles(Array.from(event.target.files ?? []));
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={Boolean(uploading)}
              onClick={() => fileInputRef.current?.click()}
            >
              選擇檔案
            </Button>
          </div>
          <Card className="lg:w-72">
            <CardHeader>
              <CardTitle>寫一則筆記</CardTitle>
              <CardDescription>標題與內文會存在這個帳號，不會變成公開頁面。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="h-10 w-full" onClick={() => setNoteOpen(true)}>
                <PenLine />
                新增筆記
              </Button>
            </CardContent>
          </Card>
        </div>

        {uploading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="size-4 animate-spin" />
            {uploading}
          </p>
        ) : null}

        {actionError ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionError}
          </p>
        ) : null}

        {items === null ? (
          <div className="grid gap-3" aria-busy="true">
            <p className="sr-only">正在載入項目</p>
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : listError ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-6"
          >
            <h2 className="text-base font-medium">讀取項目時發生問題</h2>
            <p className="mt-1 text-sm text-muted-foreground">{listError}</p>
            <Button className="mt-4 h-10" variant="outline" onClick={() => void loadItems()}>
              再試一次
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
            <h2 className="text-lg font-medium">匣子還是空的</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              上傳一個檔案，或寫下第一則筆記。內容只會出現在這個帳號。
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.id}>
                <article className="flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                  {item.type === "image" ? (
                    <button
                      type="button"
                      className="block w-full bg-muted"
                      onClick={() => {
                        setPreviewFailed(false);
                        setPreview(item);
                      }}
                    >
                      {/* User-owned bytes are served by our API, not the image optimizer. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/items/${item.id}/content`}
                        alt=""
                        className="h-40 w-full object-cover"
                      />
                    </button>
                  ) : null}
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-medium" title={item.name}>
                          {item.name}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatSize(item.size)} · {timeFormat.format(new Date(item.createdAt))}
                        </p>
                      </div>
                      <Badge variant="secondary">{typeLabel[item.type]}</Badge>
                    </div>
                    {item.type === "text" ? (
                      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {item.excerpt ?? "（沒有內文）"}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap gap-2">
                      {item.type === "image" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => {
                            setPreviewFailed(false);
                            setPreview(item);
                          }}
                        >
                          <ImageIcon />
                          預覽
                        </Button>
                      ) : null}
                      {item.type === "text" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => void openNote(item)}
                        >
                          <FileText />
                          查看
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" className="h-9" asChild>
                        <a href={`/api/items/${item.id}/content?disposition=attachment`}>
                          <Download />
                          下載
                        </a>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-9"
                        onClick={() => setPendingDelete(item)}
                      >
                        <Trash2 />
                        刪除
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增筆記</DialogTitle>
            <DialogDescription>標題會顯示在清單裡，內文可以稍後再打開。</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="note-title">標題</Label>
              <Input
                id="note-title"
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                className="h-11 text-base md:text-sm"
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="note-body">內文</Label>
              <Textarea
                id="note-body"
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                className="min-h-40 text-base md:text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)} disabled={savingNote}>
              取消
            </Button>
            <Button onClick={() => void saveNote()} disabled={savingNote}>
              {savingNote ? "儲存中…" : "儲存筆記"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>刪除這個項目？</DialogTitle>
            <DialogDescription>
              「{pendingDelete?.name}」會從你的帳號移除，無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? "刪除中…" : "刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
            <DialogDescription>圖片預覽。下載會取得原始檔案。</DialogDescription>
          </DialogHeader>
          {preview ? (
            previewFailed ? (
              <p role="alert" className="text-sm text-destructive">
                無法顯示這張圖片。你可以改為下載原檔。
              </p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/items/${preview.id}/content`}
                alt={preview.name}
                className="max-h-[60vh] w-full rounded-lg bg-muted object-contain"
                onError={() => setPreviewFailed(true)}
              />
            )
          ) : null}
          <DialogFooter>
            {preview ? (
              <Button asChild variant="outline">
                <a href={`/api/items/${preview.id}/content?disposition=attachment`}>下載</a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setPreview(null)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reading)}
        onOpenChange={(open) => {
          if (!open) setReading(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate">{reading?.name}</DialogTitle>
            <DialogDescription>這則筆記只存在你的帳號裡。</DialogDescription>
          </DialogHeader>
          {readingState === "loading" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在讀取筆記
            </p>
          ) : readingState === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              無法讀取這則筆記。
            </p>
          ) : (
            <p className="max-h-[50vh] overflow-auto text-sm leading-7 whitespace-pre-wrap">
              {reading?.body?.length ? reading.body : "（沒有內文）"}
            </p>
          )}
          <DialogFooter>
            {reading ? (
              <Button asChild variant="outline">
                <a href={`/api/items/${reading.id}/content?disposition=attachment`}>下載</a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setReading(null)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
