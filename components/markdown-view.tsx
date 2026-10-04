import type { ReactNode } from "react";

export function MarkdownView({ source }: { source: string }) {
  return <div className="flex flex-col gap-2 text-sm leading-7">{renderBlocks(source)}</div>;
}

function renderBlocks(source: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.startsWith("```")) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre key={key} className="overflow-auto rounded-lg bg-muted px-3 py-2 text-xs">
          <code>{body.join("\n")}</code>
        </pre>,
      );
      key += 1;
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const text = inline(heading[2] ?? "");
      const className = level === 1 ? "text-xl font-semibold" : "text-base font-semibold";
      blocks.push(
        <p key={key} className={className}>
          {text}
        </p>,
      );
      key += 1;
      index += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push(<li key={items.length}>{inline((lines[index] ?? "").replace(/^\s*[-*]\s+/, ""))}</li>);
        index += 1;
      }
      blocks.push(
        <ul key={key} className="list-disc pl-5">
          {items}
        </ul>,
      );
      key += 1;
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() &&
      !/^(#{1,3})\s+/.test(lines[index] ?? "") &&
      !/^\s*[-*]\s+/.test(lines[index] ?? "") &&
      !(lines[index] ?? "").startsWith("```")
    ) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(<p key={key}>{inline(paragraph.join(" "))}</p>);
    key += 1;
  }
  return blocks;
}

function inline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-xs">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      nodes.push(
        <a key={key} href={link?.[2]} className="underline" target="_blank" rel="noreferrer">
          {link?.[1]}
        </a>,
      );
    }
    key += 1;
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
