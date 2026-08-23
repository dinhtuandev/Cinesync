import "server-only";

import type { EpisodeServer, MovieListItem } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Shared provider infrastructure: HTTP fetcher + per-runtime TTL cache.
//
// Best-effort per-runtime cache.
// Nằm trong bộ nhớ của MỘT runtime Node duy nhất — KHÔNG chia sẻ giữa
// các instance serverless của Vercel. Mỗi cold start là một cache mới.
// ─────────────────────────────────────────────────────────────────────────────

export interface PagedMovies {
  items: MovieListItem[];
  page: number;
  totalPages: number;
  /** Provider key phục vụ hiển thị nhãn nguồn ("Nguồn 1"/"Nguồn 2") */
  source?: string;
}

export interface NamedItem {
  name: string;
  slug: string;
}

/** Lỗi từ upstream provider (HTTP lỗi, network, timeout) — đủ điều kiện stale-on-error. */
export class MdpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MdpError";
  }
}

const MDP_TIMEOUT_MS = 8_000;

export function createFetcher(baseUrl: string) {
  return async function mdpGet(
    path: string,
    params: Record<string, string | number> = {},
  ): Promise<Record<string, unknown>> {
    const url = new URL(path.replace(/^\//, ""), `${baseUrl}/`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(MDP_TIMEOUT_MS),
      });
    } catch (error) {
      const reason =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
          ? "timeout"
          : "network error";
      throw new MdpError(`MDP ${reason}: ${path}`);
    }
    if (!res.ok) throw new MdpError(`MDP ${res.status}: ${path}`);
    return res.json();
  };
}

// Cache TTL theo BR-08: list 15 phút, detail 60 phút; upstream lỗi → trả stale.
const TTL_MS = { list: 15 * 60 * 1000, detail: 60 * 60 * 1000 } as const;
const MAX_CACHE_ENTRIES = 500;

type CacheEntry = { data: unknown; storedAt: number; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function evictIfNeeded() {
  while (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
}

export async function withCache<T>(
  key: string,
  kind: keyof typeof TTL_MS,
  fetcher: () => Promise<T>,
  opts: { maxAgeMs?: number } = {},
): Promise<T> {
  const now = Date.now();
  const hit = responseCache.get(key);
  if (
    hit &&
    hit.expiresAt > now &&
    now - hit.storedAt <= (opts.maxAgeMs ?? Number.POSITIVE_INFINITY)
  ) {
    return hit.data as T;
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const task = fetcher()
    .then((data) => {
      evictIfNeeded();
      responseCache.set(key, { data, storedAt: Date.now(), expiresAt: Date.now() + TTL_MS[kind] });
      return data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, task);
  try {
    return await task;
  } catch (error) {
    if (hit && error instanceof MdpError) return hit.data as T;
    throw error;
  }
}

// ─── Normalization helpers dùng chung ───

export function str(value: unknown): string {
  return typeof value === "string" && value ? value : "";
}

/** Ghép URL ảnh CDN cho provider trả đường dẫn tương đối (KKPhim). */
export function absoluteImageUrl(value: unknown, cdnBase: string): string {
  const s = str(value);
  if (!s) return "";
  if (s.startsWith("http")) return s;
  return `${cdnBase.replace(/\/$/, "")}/${s.replace(/^\//, "")}`;
}

export interface RawEpisodeServer {
  server_name?: unknown;
  server_data?: {
    name?: unknown;
    slug?: unknown;
    link_embed?: unknown;
    link_m3u8?: unknown;
  }[];
}

export function normalizeEpisodes(rawEpisodes: unknown): EpisodeServer[] {
  if (!Array.isArray(rawEpisodes)) return [];
  return rawEpisodes.map((server) => {
    const s = server as RawEpisodeServer;
    return {
      serverName: str(s.server_name || "Server #1").replace(/\s+/g, " ").trim() || "Server #1",
      serverData: (s.server_data ?? []).map((ep) => ({
        name: str(ep.name),
        slug: str(ep.slug),
        linkEmbed: str(ep.link_embed),
        linkM3u8: str(ep.link_m3u8) || null,
      })),
    };
  });
}

export interface MovieProviderRawItem {
  name: string;
  origin_name?: string;
  slug: string;
  poster_url?: unknown;
  thumb_url?: unknown;
  year?: number | null;
  quality?: string;
  lang?: string;
  type?: string;
  episode_current?: number | string | null;
  episode_total?: number | null;
}

export function normalizeListItem(
  item: MovieProviderRawItem,
  imageCdn: string,
): MovieListItem {
  const isSeries = item.type === "series";
  return {
    slug: item.slug,
    name: item.name ?? "",
    originName: item.origin_name ?? "",
    posterUrl: absoluteImageUrl(item.poster_url, imageCdn),
    thumbUrl: absoluteImageUrl(item.thumb_url, imageCdn),
    year: typeof item.year === "number" ? item.year : 0,
    quality: (item.quality as MovieListItem["quality"]) ?? "HD",
    lang: (item.lang as MovieListItem["lang"]) ?? "Vietsub",
    episodeCurrent:
      isSeries && typeof item.episode_current === "number" ? item.episode_current : undefined,
    episodeTotal:
      isSeries && typeof item.episode_total === "number" ? item.episode_total : undefined,
  };
}
