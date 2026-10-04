"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import {
  ChevronDown,
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
import { LanguageSwitcher } from "@/components/language-switcher";
import { LinkPreviewCard } from "@/components/link-preview-card";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MarkdownView } from "@/components/markdown-view";
import { chosenNoteGroup, NoteGroupField } from "@/components/note-group-field";
import type { Locale } from "@/lib/locale";
import { messages } from "@/lib/messages";
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
  group: string | null;
  tags: string[];
};

type SortMode = "newest" | "oldest" | "name";
type TypeFilter = "all" | ItemType;

const UNGROUPED = "未分組";

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

function noteCopyText(title: string, body: string) {
  const name = title.trim();
  const text = body.trim();
  if (name && text) return `${name}\n\n${text}`;
  if (name) return name;
  return text;
}

async function writeClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* mobile browsers may reject the async clipboard API */
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

function compareItems(sortMode: SortMode, left: Item, right: Item) {
  if (sortMode === "name") return left.name.localeCompare(right.name, "zh-Hant");
  const delta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  return sortMode === "oldest" ? delta : -delta;
}

function sectionMoment(sortMode: SortMode, list: Item[]) {
  const times = list.map((item) => new Date(item.createdAt).getTime());
  return sortMode === "oldest" ? Math.min(...times) : Math.max(...times);
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

export function LibraryApp({ user, locale }: { user: PublicUser; locale: Locale }) {
  const copy = messages[locale];
  const [items, setItems] = useState<Item[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyNotice, setPasskeyNotice] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteGroup, setNoteGroup] = useState("");
  const [noteGroupCustom, setNoteGroupCustom] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [pendingGroup, setPendingGroup] = useState<{
    key: string;
    label: string;
    count: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<Item | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [reading, setReading] = useState<Item | null>(null);
  const [readingState, setReadingState] = useState<"loading" | "ready" | "error">(
    "ready",
  );
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tagTarget, setTagTarget] = useState<Item | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [groupTarget, setGroupTarget] = useState<Item | null>(null);
  const [groupDraft, setGroupDraft] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
      setItems(
        data.items.map((item) => ({
          ...item,
          group: item.group ?? null,
          tags: item.tags ?? [],
        })),
      );
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

  function openComposer(item?: Item) {
    setEditingId(item?.id ?? null);
    setNoteTitle(item?.name ?? "");
    setNoteBody(item?.body ?? "");
    setNoteGroup(item?.group ?? "");
    setNoteGroupCustom("");
    setNoteOpen(true);
  }

  async function saveNote() {
    setActionError(null);
    setSavingNote(true);
    const payload = {
      title: noteTitle,
      body: noteBody,
      group: chosenNoteGroup(noteGroup, noteGroupCustom),
    };
    try {
      const response = await fetch(editingId ? `/api/items/${editingId}` : "/api/items", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? payload : { type: "text", ...payload }),
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
      setEditingId(null);
      setNoteTitle("");
      setNoteBody("");
      setNoteGroup("");
      setNoteGroupCustom("");
      setReading(null);
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

  async function confirmGroupDelete() {
    if (!pendingGroup) return;
    setDeleting(true);
    setActionError(null);
    try {
      const response = await fetch("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: pendingGroup.key === UNGROUPED ? null : pendingGroup.label,
        }),
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
      setPendingGroup(null);
      setPreview(null);
      setReading(null);
      setDeleting(false);
      await loadItems();
    } catch {
      setActionError("刪除分組時無法連線");
      setDeleting(false);
    }
  }

  async function copyNote(item: Item) {
    setActionError(null);
    try {
      const response = await fetch(`/api/items/${item.id}`);
      if (response.status === 401) {
        goToLogin();
        return;
      }
      if (!response.ok) {
        setActionError(await errorMessage(response));
        return;
      }
      const data = (await response.json()) as { item: Item };
      const copied = await writeClipboard(noteCopyText(data.item.name, data.item.body ?? ""));
      if (!copied) {
        setActionError("無法複製這則筆記");
        return;
      }
      setCopiedId(item.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === item.id ? null : current));
      }, 2000);
    } catch {
      setActionError("無法複製這則筆記");
    }
  }

  async function startEdit(item: Item) {
    setActionError(null);
    try {
      const response = await fetch(`/api/items/${item.id}`);
      if (response.status === 401) {
        goToLogin();
        return;
      }
      if (!response.ok) {
        setActionError(await errorMessage(response));
        return;
      }
      const data = (await response.json()) as { item: Item };
      openComposer(data.item);
    } catch {
      setActionError(copy.network);
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
      setReading({ ...data.item, group: data.item.group ?? null, tags: data.item.tags ?? [] });
      setReadingState("ready");
    } catch {
      setReadingState("error");
    }
  }

  async function patchItem(item: Item, body: { group?: string | null; tags?: string[] }) {
    setSavingMeta(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        goToLogin();
        return false;
      }
      if (!response.ok) {
        setActionError(await errorMessage(response));
        return false;
      }
      const data = (await response.json()) as { item: Item };
      setItems(
        (current) =>
          current?.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  group: data.item.group ?? null,
                  tags: data.item.tags ?? [],
                }
              : entry,
          ) ?? null,
      );
      return true;
    } catch {
      setActionError("無法更新這個項目");
      return false;
    } finally {
      setSavingMeta(false);
    }
  }

  const knownGroups = useMemo(() => {
    const names = new Set<string>();
    for (const item of items ?? []) {
      if (item.group) names.add(item.group);
    }
    return [...names].sort((left, right) => left.localeCompare(right, "zh-Hant"));
  }, [items]);

  const sections = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const filtered = (items ?? []).filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (
        tagFilter &&
        !item.tags.some((tag) => tag.toLocaleLowerCase() === tagFilter.toLocaleLowerCase())
      ) {
        return false;
      }
      if (!needle) return true;
      const note = item.type === "text" ? (item.excerpt ?? "") : "";
      return `${item.name} ${note}`.toLocaleLowerCase().includes(needle);
    });
    const grouped = new Map<string, Item[]>();
    const loose: Item[] = [];
    for (const item of filtered) {
      if (item.group) {
        const list = grouped.get(item.group) ?? [];
        list.push(item);
        grouped.set(item.group, list);
      } else {
        loose.push(item);
      }
    }
    const named = [...grouped.entries()].map(([label, list]) => ({
      key: label,
      label,
      items: [...list].sort((left, right) => compareItems(sortMode, left, right)),
    }));
    named.sort((left, right) => {
      if (sortMode === "name") return left.label.localeCompare(right.label, "zh-Hant");
      const delta = sectionMoment(sortMode, left.items) - sectionMoment(sortMode, right.items);
      return sortMode === "oldest" ? delta : -delta;
    });
    if (loose.length > 0) {
      named.push({
        key: UNGROUPED,
        label: UNGROUPED,
        items: [...loose].sort((left, right) => compareItems(sortMode, left, right)),
      });
    }
    return named;
  }, [items, query, sortMode, tagFilter, typeFilter]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Mark className="size-8 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight">{copy.brand}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher locale={locale} />
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
              {copy.logout}
            </Button>
          </div>
        </div>
        {passkeyNotice ? (
          <p role="status" className="px-4 pb-3 text-sm text-muted-foreground">
            {passkeyNotice}
          </p>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-28 sm:py-8">
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
          <Card className="hidden sm:block lg:w-72">
            <CardHeader>
              <CardTitle>{copy.newNote}</CardTitle>
              <CardDescription>{copy.libraryIntro}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="h-10 w-full" onClick={() => openComposer()}>
                <PenLine />
                {copy.newNote}
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

        {items && items.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                aria-label={copy.search}
                className="h-11 text-base md:text-sm"
              />
              <select
                aria-label="類型"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="all">{copy.allTypes}</option>
                <option value="file">{copy.sampleFile}</option>
                <option value="image">{copy.sampleImage}</option>
                <option value="text">{copy.sampleNote}</option>
              </select>
              <select
                aria-label="排序"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="newest">{copy.newest}</option>
                <option value="oldest">{copy.oldest}</option>
                <option value="name">{copy.byName}</option>
              </select>
            </div>
            {tagFilter ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>標籤：{tagFilter}</span>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setTagFilter(null)}>
                  清除
                </Button>
              </div>
            ) : null}
          </div>
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
        ) : sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
            <h2 className="text-lg font-medium">沒有符合的項目</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              試著清掉搜尋、類型或標籤，項目還在這個帳號裡。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {sections.map((section) => {
              const open = !collapsed[section.key];
              return (
                <section key={section.key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={open}
                      onClick={() =>
                        setCollapsed((current) => ({ ...current, [section.key]: open }))
                      }
                    >
                      <ChevronDown
                        className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
                      />
                      <span className="truncate text-sm font-medium">{section.label}</span>
                      <span className="text-sm text-muted-foreground">{section.items.length}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-destructive"
                      onClick={() => {
                        const count = (items ?? []).filter((item) =>
                          section.key === UNGROUPED ? !item.group : item.group === section.label,
                        ).length;
                        setPendingGroup({ key: section.key, label: section.label, count });
                      }}
                    >
                      刪除分組
                    </Button>
                  </div>
                  {open ? (
                    <ul className="flex flex-col gap-2">
                      {section.items.map((item) => (
                        <li key={item.id}>
                          <article className="rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
                            <div className="flex gap-3">
                              {item.type === "image" ? (
                                <button
                                  type="button"
                                  className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted"
                                  onClick={() => {
                                    setPreviewFailed(false);
                                    setPreview(item);
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`/api/items/${item.id}/content`}
                                    alt=""
                                    className="size-10 object-cover"
                                  />
                                </button>
                              ) : (
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                  {item.type === "text" ? (
                                    <FileText className="size-4" />
                                  ) : (
                                    <Upload className="size-4" />
                                  )}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <h2 className="truncate text-sm font-medium" title={item.name}>
                                    {item.name}
                                  </h2>
                                  <Badge variant="secondary">{typeLabel[item.type]}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {typeLabel[item.type]} · {formatSize(item.size)} ·{" "}
                                  {timeFormat.format(new Date(item.createdAt))}
                                </p>
                                {item.type === "text" ? (
                                  <>
                                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                      {item.excerpt ?? "（沒有內文）"}
                                    </p>
                                    <LinkPreviewCard text={item.excerpt ?? ""} />
                                  </>
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  {item.tags.map((tag) => (
                                    <button
                                      key={tag}
                                      type="button"
                                      className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                                      onClick={() => setTagFilter(tag)}
                                    >
                                      {tag}
                                    </button>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-dashed"
                                    onClick={() => {
                                      setTagDraft("");
                                      setTagTarget(item);
                                    }}
                                  >
                                    + 標籤
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7"
                                    onClick={() => {
                                      setGroupDraft(item.group ?? "");
                                      setGroupTarget(item);
                                    }}
                                  >
                                    移到分組
                                  </Button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
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
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9"
                                        onClick={() => void copyNote(item)}
                                      >
                                        {copiedId === item.id ? "已複製" : "複製"}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9"
                                        onClick={() => void startEdit(item)}
                                      >
                                        <PenLine />
                                        {copy.edit}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9"
                                        onClick={() => void openNote(item)}
                                      >
                                        <FileText />
                                        查看
                                      </Button>
                                    </>
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
                            </div>
                          </article>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Dialog
        open={noteOpen}
        onOpenChange={(open) => {
          setNoteOpen(open);
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? copy.editNote : copy.newNote}</DialogTitle>
            <DialogDescription>{copy.noteDialogLead}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="note-title">{copy.noteTitle}</Label>
              <Input
                id="note-title"
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                className="h-11 text-base md:text-sm"
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="note-body">{copy.noteBody}</Label>
              <MarkdownEditor
                labelledBy="note-body"
                value={noteBody}
                onChange={setNoteBody}
                copy={copy}
              />
              <LinkPreviewCard text={noteBody} />
            </div>
            <NoteGroupField
              groups={knownGroups}
              selected={noteGroup}
              custom={noteGroupCustom}
              onSelected={setNoteGroup}
              onCustom={setNoteGroupCustom}
              groupLabel={copy.group}
              newGroupLabel={copy.newGroup}
              ungroupedLabel={copy.ungrouped}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)} disabled={savingNote}>
              {copy.cancel}
            </Button>
            <Button onClick={() => void saveNote()} disabled={savingNote}>
              {savingNote ? copy.saving : copy.saveNote}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingGroup)} onOpenChange={(open) => !open && setPendingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingGroup?.key === UNGROUPED
                ? `刪除未分組入面全部 ${pendingGroup.count} 個項目？`
                : `刪除「${pendingGroup?.label}」入面全部 ${pendingGroup?.count} 個項目？`}
            </DialogTitle>
            <DialogDescription>這些項目會從你的帳號移除，無法復原。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingGroup(null)} disabled={deleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void confirmGroupDelete()} disabled={deleting}>
              {deleting ? "刪除中…" : "刪除分組"}
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
            <>
              <div className="max-h-[50vh] overflow-auto">
                {reading?.body?.length ? (
                  <MarkdownView source={reading.body} />
                ) : (
                  <p className="text-sm text-muted-foreground">{copy.emptyNote}</p>
                )}
              </div>
              <LinkPreviewCard text={reading?.body ?? ""} />
            </>
          )}
          <DialogFooter>
            {reading && readingState === "ready" ? (
              <Button
                variant="outline"
                onClick={() => {
                  const current = reading;
                  setReading(null);
                  openComposer(current);
                }}
              >
                {copy.edit}
              </Button>
            ) : null}
            {reading ? (
              <Button asChild variant="outline">
                <a href={`/api/items/${reading.id}/content?disposition=attachment`}>下載</a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setReading(null)}>
              {copy.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(tagTarget)}
        onOpenChange={(open) => {
          if (!open) setTagTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>加上標籤</DialogTitle>
            <DialogDescription>點清單上的標籤可以篩選。這裡可以新增或拿掉。</DialogDescription>
          </DialogHeader>
          {tagTarget && tagTarget.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tagTarget.tags.map((tag) => (
                <Button
                  key={tag}
                  variant="outline"
                  size="sm"
                  disabled={savingMeta}
                  onClick={() => {
                    const next = tagTarget.tags.filter(
                      (entry) => entry.toLocaleLowerCase() !== tag.toLocaleLowerCase(),
                    );
                    void patchItem(tagTarget, { tags: next }).then((ok) => {
                      if (ok) setTagTarget({ ...tagTarget, tags: next });
                    });
                  }}
                >
                  {tag} · 移除
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="tag-draft">新標籤</Label>
            <Input
              id="tag-draft"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              className="h-11 text-base md:text-sm"
              maxLength={40}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagTarget(null)} disabled={savingMeta}>
              關閉
            </Button>
            <Button
              disabled={savingMeta || !tagDraft.trim() || !tagTarget}
              onClick={() => {
                if (!tagTarget) return;
                const next = [...tagTarget.tags, tagDraft];
                void patchItem(tagTarget, { tags: next }).then((ok) => {
                  if (!ok) return;
                  setTagDraft("");
                  setTagTarget(null);
                });
              }}
            >
              {savingMeta ? "儲存中…" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(groupTarget)}
        onOpenChange={(open) => {
          if (!open) setGroupTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移到分組</DialogTitle>
            <DialogDescription>空白或未分組會把項目放到最後一個區段。</DialogDescription>
          </DialogHeader>
          {knownGroups.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {knownGroups.map((name) => (
                <Button
                  key={name}
                  variant={groupDraft === name ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupDraft(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-draft">分組名稱</Label>
            <Input
              id="group-draft"
              value={groupDraft}
              onChange={(event) => setGroupDraft(event.target.value)}
              className="h-11 text-base md:text-sm"
              maxLength={80}
              placeholder="例如工作"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={savingMeta || !groupTarget}
              onClick={() => {
                if (!groupTarget) return;
                void patchItem(groupTarget, { group: null }).then((ok) => {
                  if (ok) setGroupTarget(null);
                });
              }}
            >
              未分組
            </Button>
            <Button
              disabled={savingMeta || !groupTarget}
              onClick={() => {
                if (!groupTarget) return;
                void patchItem(groupTarget, { group: groupDraft }).then((ok) => {
                  if (ok) setGroupTarget(null);
                });
              }}
            >
              {savingMeta ? "儲存中…" : "移動"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed inset-x-0 z-30 px-4 sm:hidden bottom-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button className="h-11 w-full shadow-md" onClick={() => openComposer()}>
          <PenLine />
          {copy.newNote}
        </Button>
      </div>
    </div>
  );
}
