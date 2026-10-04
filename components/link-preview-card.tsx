"use client";

import { useEffect, useState } from "react";
import { firstHttpUrl } from "@/lib/public-url";

type Preview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string;
};

export function LinkPreviewCard({ text }: { text: string }) {
  const url = firstHttpUrl(text);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) return null;
          const data = (await response.json()) as { preview?: Preview };
          return data.preview ?? null;
        })
        .then((next) => {
          if (!controller.signal.aborted) setPreview(next);
        })
        .catch(() => {
          if (!controller.signal.aborted) setPreview(null);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [url]);

  if (!url) return null;

  const title = preview?.title || preview?.site || hostnameOf(url);
  const description = preview?.description || hostnameOf(url);

  return (
    <a
      href={preview?.url ?? url}
      target="_blank"
      rel="noreferrer"
      className="mt-3 block overflow-hidden rounded-xl border bg-card text-left no-underline"
      data-link-preview="true"
    >
      {preview?.image ? (
        <img src={preview.image} alt="" className="h-40 w-full bg-muted object-cover" />
      ) : null}
      <span className="block px-3 py-2">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </a>
  );
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
