"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, File, Folder, ImageIcon, Loader2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ItemType } from "@/lib/constants";
import type { Locale } from "@/lib/locale";
import { localizePhrase } from "@/lib/known-phrases";
import { messages } from "@/lib/messages";

type FileItem = {
  id: string;
  type: ItemType;
  name: string;
  size: number;
  createdAt: string;
  group: string | null;
};

const UNGROUPED_KEY = "";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const value = bytes / 1024;
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function FilesExplorer({ userEmail, locale }: { userEmail: string; locale: Locale }) {
  const copy = messages[locale];
  const timeFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "en" ? "en" : locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );
  const [items, setItems] = useState<FileItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [folderKey, setFolderKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingBulk, setPendingBulk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/items");
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
          const message =
            data && typeof data.error === "string"
              ? localizePhrase(data.error, locale)
              : copy.requestFailed;
          if (!cancelled) {
            setListError(message);
            setItems([]);
          }
          return;
        }
        const data = (await response.json()) as { items?: FileItem[] };
        const files = (data.items ?? []).filter((item) => item.type === "file" || item.type === "image");
        if (!cancelled) {
          setItems(files);
          setListError(null);
        }
      } catch {
        if (!cancelled) {
          setListError(copy.network);
          setItems([]);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [copy.network, copy.requestFailed, locale, reloadKey]);

  const folders = useMemo(() => {
    const grouped = new Map<string, FileItem[]>();
    for (const item of items ?? []) {
      const key = item.group?.trim() ? item.group : UNGROUPED_KEY;
      const list = grouped.get(key) ?? [];
      list.push(item);
      grouped.set(key, list);
    }
    const named = [...grouped.entries()]
      .filter(([key]) => key !== UNGROUPED_KEY)
      .sort(([left], [right]) => left.localeCompare(right, locale));
    const loose = [...(grouped.get(UNGROUPED_KEY) ?? [])].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
    return [
      ...named.map(([key, folderItems]) => ({
        key,
        label: key,
        items: [...folderItems].sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        ),
      })),
      { key: UNGROUPED_KEY, label: copy.ungrouped, items: loose },
    ];
  }, [copy.ungrouped, items, locale]);

  const openFolder = folderKey == null ? null : (folders.find((folder) => folder.key === folderKey) ?? null);

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function confirmBulkDelete() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/items/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
        const message =
          data && typeof data.error === "string"
            ? localizePhrase(data.error, locale)
            : copy.requestFailed;
        setActionError(message);
        setDeleting(false);
        return;
      }
      setSelectedIds([]);
      setPendingBulk(false);
      setDeleting(false);
      setActionError(null);
      setReloadKey((value) => value + 1);
    } catch {
      setActionError(copy.network);
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/product" className="flex min-w-0 items-center gap-3">
            <Mark className="size-8 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight">{copy.filesTitle}</p>
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher locale={locale} />
            <Button asChild variant="outline" className="h-10">
              <Link href="/">{copy.filesLibrary}</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
        <p className="text-sm leading-6 text-muted-foreground">{copy.filesLead}</p>
        {actionError ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionError}
          </p>
        ) : null}
        {items === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
            <Loader2 className="size-4 animate-spin" />
            <span>{copy.loadingItems}</span>
          </div>
        ) : listError ? (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-6">
            <h2 className="text-base font-medium">{copy.loadErrorTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{listError}</p>
          </div>
        ) : openFolder ? (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => {
                  setSelectedIds([]);
                  setFolderKey(null);
                }}
              >
                <ArrowLeft />
                {copy.filesBack}
              </Button>
              <h2 className="text-base font-medium">{openFolder.label}</h2>
              <span className="text-sm text-muted-foreground">
                {fill(copy.filesCount, { count: openFolder.items.length })}
              </span>
              {selectedIds.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 text-destructive"
                  onClick={() => setPendingBulk(true)}
                >
                  {fill(copy.selectedCount, { count: selectedIds.length })} · {copy.deleteSelected}
                </Button>
              ) : null}
            </div>
            {openFolder.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                {copy.filesEmptyFolder}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {openFolder.items.map((item) => {
                  const href =
                    item.type === "image"
                      ? `/api/items/${item.id}/content`
                      : `/api/items/${item.id}/content?disposition=attachment`;
                  return (
                    <li key={item.id}>
                      <div className="flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:items-center sm:p-4">
                        <input
                          type="checkbox"
                          className="mt-3 size-4 shrink-0"
                          checked={selectedIds.includes(item.id)}
                          aria-label={fill(copy.selectFile, { name: item.name })}
                          onChange={() => toggleSelected(item.id)}
                        />
                      <a
                        href={href}
                        className="flex min-w-0 flex-1 items-start gap-3 sm:items-center"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          {item.type === "image" ? <ImageIcon className="size-4" /> : <File className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium" title={item.name}>
                            {item.name}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatSize(item.size)} · {timeFormat.format(new Date(item.createdAt))}
                          </span>
                        </span>
                      </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {folders.map((folder) => (
              <li key={folder.key || "ungrouped"}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10"
                  onClick={() => setFolderKey(folder.key)}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <Folder className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{folder.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {fill(copy.filesCount, { count: folder.items.length })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {items && items.length === 0 && !listError && folderKey == null ? (
          <p className="text-sm text-muted-foreground">{copy.filesEmpty}</p>
        ) : null}
      </main>
      <Dialog open={pendingBulk} onOpenChange={(open) => !open && !deleting && setPendingBulk(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fill(copy.deleteSelectedTitle, { count: selectedIds.length })}</DialogTitle>
            <DialogDescription>
              {fill(copy.deleteSelectedBody, { count: selectedIds.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingBulk(false)} disabled={deleting}>
              {copy.cancel}
            </Button>
            <Button variant="destructive" onClick={() => void confirmBulkDelete()} disabled={deleting}>
              {deleting ? copy.deleting : copy.deleteSelected}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
