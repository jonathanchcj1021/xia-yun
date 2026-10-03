import { isBlockedAddress, isYouTubeHost, parseHttpUrl } from "@/lib/public-url";

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string;
};

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

export async function fetchLinkPreview(
  raw: string,
): Promise<{ preview: LinkPreview } | { error: string }> {
  const parsed = parseHttpUrl(raw);
  if (!parsed.ok) return { error: "只接受公開的 http 或 https 網址" };
  try {
    await assertPublicHost(parsed.url.hostname);
  } catch {
    return { error: "只接受公開的 http 或 https 網址" };
  }
  if (isYouTubeHost(parsed.url.hostname)) {
    const youtube = await youtubePreview(parsed.url);
    if (youtube) return { preview: youtube };
  }
  return { preview: await pagePreview(parsed.url, 0) };
}

async function youtubePreview(url: URL): Promise<LinkPreview | null> {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("url", url.toString());
  try {
    await assertPublicHost(endpoint.hostname);
    const response = await fetch(endpoint, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      title?: unknown;
      author_name?: unknown;
      thumbnail_url?: unknown;
    };
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    if (!title) return null;
    const image = publicImage(payload.thumbnail_url, url);
    const author = typeof payload.author_name === "string" ? payload.author_name.trim() : "";
    return {
      url: url.toString(),
      title,
      description: author || url.hostname,
      image,
      site: url.hostname,
    };
  } catch {
    return null;
  }
}

async function pagePreview(url: URL, redirects: number): Promise<LinkPreview> {
  const fallback = blankPreview(url);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "XiaYunLinkPreview/1.0",
      },
    });
  } catch {
    return fallback;
  }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirects >= MAX_REDIRECTS) return fallback;
    const next = parseHttpUrl(new URL(location, url).toString());
    if (!next.ok) return fallback;
    try {
      await assertPublicHost(next.url.hostname);
    } catch {
      return fallback;
    }
    return pagePreview(next.url, redirects + 1);
  }
  if (!response.ok) return fallback;
  const type = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml/i.test(type)) return fallback;
  const html = await readLimitedText(response);
  if (!html) return fallback;
  const meta = metaMap(html);
  const title = meta.get("og:title") || meta.get("twitter:title") || pageTitle(html);
  const description =
    meta.get("og:description") || meta.get("twitter:description") || meta.get("description");
  const image = publicImage(
    meta.get("og:image") || meta.get("twitter:image") || null,
    url,
  );
  return {
    url: url.toString(),
    title: title || null,
    description: description || url.hostname,
    image,
    site: url.hostname,
  };
}

function blankPreview(url: URL): LinkPreview {
  return {
    url: url.toString(),
    title: null,
    description: url.hostname,
    image: null,
    site: url.hostname,
  };
}

async function assertPublicHost(hostname: string) {
  if (hostname.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error("blocked");
    return;
  }
  const addresses = await resolveHost(hostname);
  if (addresses.length === 0 || addresses.some((address) => isBlockedAddress(address))) {
    throw new Error("blocked");
  }
}

async function resolveHost(hostname: string): Promise<string[]> {
  const [v4, v6] = await Promise.all([dns(hostname, "A"), dns(hostname, "AAAA")]);
  return [...v4, ...v6];
}

async function dns(hostname: string, type: "A" | "AAAA"): Promise<string[]> {
  const endpoint = new URL("https://cloudflare-dns.com/dns-query");
  endpoint.searchParams.set("name", hostname);
  endpoint.searchParams.set("type", type);
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/dns-json" },
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    Status?: number;
    Answer?: { type?: number; data?: string }[];
  };
  if (payload.Status !== 0 || !payload.Answer) return [];
  const wanted = type === "A" ? 1 : 28;
  return payload.Answer.filter((row) => row.type === wanted && typeof row.data === "string").map(
    (row) => row.data as string,
  );
}

async function readLimitedText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(step.value);
  }
  const merged = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= merged.length) break;
  }
  return new TextDecoder().decode(merged);
}

function metaMap(html: string) {
  const map = new Map<string, string>();
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key = attr(tag, "property") ?? attr(tag, "name");
    const content = attr(tag, "content");
    if (!key || !content) continue;
    const name = decode(key).toLowerCase();
    if (!map.has(name)) map.set(name, decode(content).trim());
  }
  return map;
}

function attr(tag: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match?.[2] ?? match?.[3] ?? null;
}

function pageTitle(html: string) {
  const match = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html);
  return match?.[1] ? decode(match[1]).trim() : null;
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function publicImage(value: unknown, page: URL) {
  if (typeof value !== "string" || !value.trim()) return null;
  let image: URL;
  try {
    image = new URL(value.trim(), page);
  } catch {
    return null;
  }
  const parsed = parseHttpUrl(image.toString());
  return parsed.ok ? parsed.url.toString() : null;
}
