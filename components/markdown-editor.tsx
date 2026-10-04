"use client";

import { useRef } from "react";
import { MarkdownView } from "@/components/markdown-view";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Copy } from "@/lib/messages";

export function MarkdownEditor({
  value,
  onChange,
  copy,
  labelledBy,
}: {
  value: string;
  onChange: (value: string) => void;
  copy: Copy;
  labelledBy?: string;
}) {
  const area = useRef<HTMLTextAreaElement>(null);

  function apply(before: string, after = "") {
    const node = area.current;
    if (!node) {
      onChange(`${value}${before}${after}`);
      return;
    }
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const selected = value.slice(start, end) || "文字";
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    const cursor = start + before.length + selected.length + after.length;
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1" role="toolbar" aria-label={copy.write}>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => apply("## ")}>
          {copy.heading}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => apply("**", "**")}>
          {copy.bold}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => apply("\n- ")}>
          {copy.list}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => apply("[", "](https://)")}
        >
          {copy.link}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => apply("`", "`")}>
          {copy.code}
        </Button>
      </div>
      <Textarea
        ref={area}
        id={labelledBy}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-40 font-mono text-base md:text-sm"
        aria-label={copy.noteBody}
      />
      <div className="rounded-lg border bg-muted/40 px-3 py-2" data-markdown-preview="true">
        <p className="mb-1 text-xs text-muted-foreground">{copy.preview}</p>
        {value.trim() ? <MarkdownView source={value} /> : <p className="text-sm text-muted-foreground">—</p>}
      </div>
    </div>
  );
}
