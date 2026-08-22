import "server-only";

import type {
  EpisodeServer,
  MovieDetail,
  MovieDetailResponse,
  MovieListItem,
} from "./types";

const BASE_URL = process.env.MOVIE_PROVIDER_BASE_URL ?? "";

if (!BASE_URL) {
  console.warn("MOVIE_PROVIDER_BASE_URL chưa được cấu hình — dữ liệu phim sẽ không tải được");
}

// ─── Cache TTL theo BR-08: list 15 phút, detail 60 phút; MDP lỗi → trả stale ───
const TTL_MS = { list: 15 * 60 * 1000, detail: 60 * 60 * 1000 } as const;
const MAX_CACHE_ENTRIES = 500;

type CacheEntry = { data: unknown; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function evictIfNeeded() {
  while (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
}

async function withCache<T>(
  key: string,
  kind: keyof typeof TTL_MS,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = responseCache.get(key);
  if (hit && hit.expiresAt > now) return hit.data as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const task = fetcher()
    .then((data) => {
      evictIfNeeded();
      responseCache.set(key, { data, expiresAt: Date.now() + TTL_MS[kind] });
      return data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, task);
  try {
    return await task;
  } catch (error) {
    if (hit) return hit.data as T; // stale-on-error
    throw error;
  }
}

interface MdpItem {
  name: string;
  origin_name?: string;
  slug: string;
  poster_url?: unknown;
  thumb_url?: unknown;
  year?: number;
  quality?: string;
  lang?: string;
  type?: string;
  episode_current?: number | string | null;
  episode_total?: number | null;
}

interface MdpPagination {
  totalItems?: number;
  totalItemsPerPage?: number;
  currentPage?: number;
  totalPages?: number;
}

function str(value: unknown): string {
  return typeof value === "string" && value ? value : "";
}

export interface PagedMovies {
  items: MovieListItem[];
  page: number;
  totalPages: number;
}

function normalizeItem(item: MdpItem): MovieListItem {
  const isSeries = item.type === "series";
  return {
    slug: item.slug,
    name: item.name ?? "",
    originName: item.origin_name ?? "",
    posterUrl: str(item.poster_url),
    thumbUrl: str(item.thumb_url),
    year: typeof item.year === "number" ? item.year : 0,
    quality: (item.quality as MovieListItem["quality"]) ?? "HD",
    lang: (item.lang as MovieListItem["lang"]) ?? "Vietsub",
    episodeCurrent:
      isSeries && typeof item.episode_current === "number"
        ? item.episode_current
        : undefined,
    episodeTotal:
      isSeries && typeof item.episode_total === "number" ? item.episode_total : undefined,
  };
}

const MDP_TIMEOUT_MS = 8_000;

async function mdpGet(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(path.replace(/^\//, ""), `${BASE_URL}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(MDP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`MDP ${res.status}: ${path}`);
  return res.json();
}

function extractItems(json: Record<string, unknown>): {
  rawItems: MdpItem[];
  pagination: MdpPagination | null;
} {
  const data = (json.data ?? {}) as Record<string, unknown>;
  const rawItems = (json.items ?? data.items ?? []) as MdpItem[];
  const pagination = (json.pagination ?? (data.pagination as MdpPagination) ?? null) as
    | MdpPagination
    | null;
  return { rawItems, pagination };
}

function toPagedMovies(json: Record<string, unknown>): PagedMovies {
  const { rawItems, pagination } = extractItems(json);
  return {
    items: rawItems.filter((i) => i?.slug).map(normalizeItem),
    page: pagination?.currentPage ?? 1,
    totalPages: pagination?.totalPages ?? 1,
  };
}

const LIST_TYPES = [
  "phim-moi-cap-nhat",
  "phim-le",
  "phim-bo",
  "long-tieng",
  "thuyet-minh",
  "dang-chieu",
  "phim-chieu-rap",
  "4k",
] as const satisfies readonly string[];

export type ListType = (typeof LIST_TYPES)[number];

export const MOVIE_LIST_TYPES = LIST_TYPES;

export async function getMovieList(
  type: ListType = "phim-moi-cap-nhat",
  page = 1,
): Promise<PagedMovies> {
  return withCache(`list:${type}:${page}`, "list", async () => {
    const json = await mdpGet(`/danh-sach/${type}`, { page });
    return toPagedMovies(json);
  });
}

export async function getHomeSections(): Promise<{ title: string; movies: MovieListItem[] }[]> {
  const sections: [string, ListType][] = [
    ["Mới cập nhật", "phim-moi-cap-nhat"],
    ["Phim lẻ", "phim-le"],
    ["Phim bộ", "phim-bo"],
    ["Phim đang chiếu", "dang-chieu"],
    ["Phim 4K", "4k"],
  ];
  const settled = await Promise.allSettled(
    sections.map(([, type]) => getMovieList(type, 1)),
  );
  return sections
    .map(([title], i) =>
      settled[i].status === "fulfilled"
        ? { title, movies: (settled[i] as PromiseFulfilledResult<PagedMovies>).value.items }
        : null,
    )
    .filter((s): s is { title: string; movies: MovieListItem[] } => s !== null && s.movies.length > 0);
}

export async function searchMovies(keyword: string, limit = 12): Promise<MovieListItem[]> {
  const kw = keyword.trim();
  if (kw.length < 2) return [];
  // TTL ngắn hơn cho tìm kiếm để kết quả còn tương đối mới
  return withCache(`search:${kw}:${limit}`, "list", async () => {
    const json = await mdpGet("/tim-kiem", { keyword: kw, limit });
    return toPagedMovies(json).items;
  });
}

export async function getGenres(): Promise<{ name: string; slug: string }[]> {
  return withCache("genres", "detail", async () => extractNamedItems(await mdpGet("/the-loai")));
}

export async function getCountries(): Promise<{ name: string; slug: string }[]> {
  return withCache("countries", "detail", async () =>
    extractNamedItems(await mdpGet("/quoc-gia")),
  );
}

export async function getYears(): Promise<{ name: string; slug: string }[]> {
  return withCache("years", "detail", async () => extractNamedItems(await mdpGet("/nam")));
}

function extractNamedItems(json: Record<string, unknown>): { name: string; slug: string }[] {
  const data = (json.data ?? {}) as Record<string, unknown>;
  const items = (json.items ?? data.items ?? []) as { name?: unknown; slug?: unknown }[];
  return items
    .filter((i) => i?.slug && i?.name)
    .map((i) => ({ name: String(i.name), slug: String(i.slug) }));
}

export async function getMoviesByGenre(slug: string, page = 1): Promise<PagedMovies> {
  return withCache(`genre:${slug}:${page}`, "list", async () =>
    toPagedMovies(await mdpGet(`/the-loai/${encodeURIComponent(slug)}`, { page })),
  );
}

export async function getMoviesByCountry(slug: string, page = 1): Promise<PagedMovies> {
  return withCache(`country:${slug}:${page}`, "list", async () =>
    toPagedMovies(await mdpGet(`/quoc-gia/${encodeURIComponent(slug)}`, { page })),
  );
}

export async function getMoviesByYear(year: string, page = 1): Promise<PagedMovies> {
  return withCache(`year:${year}:${page}`, "list", async () =>
    toPagedMovies(await mdpGet(`/nam/${encodeURIComponent(year)}`, { page })),
  );
}

function normalizeEpisodes(rawEpisodes: unknown): EpisodeServer[] {
  if (!Array.isArray(rawEpisodes)) return [];
  return rawEpisodes.map((server) => {
    const s = server as {
      server_name?: string;
      server_data?: { name?: string; slug?: string; link_embed?: unknown; link_m3u8?: unknown }[];
    };
    return {
      serverName: (s.server_name ?? "Server #1").replace(/\s+/g, " ").trim(),
      serverData: (s.server_data ?? []).map((ep) => ({
        name: ep.name ?? "",
        slug: ep.slug ?? "",
        linkEmbed: str(ep.link_embed),
        linkM3u8: str(ep.link_m3u8) || null,
      })),
    };
  });
}

export async function getMovieDetail(slug: string): Promise<MovieDetailResponse | null> {
  return withCache(`detail:${slug}`, "detail", async () => {
    let json: Record<string, unknown>;
    try {
      json = await mdpGet(`/phim/${encodeURIComponent(slug)}`);
    } catch {
      return null;
    }
    const movie = json.movie as (MdpItem & {
      content?: string;
      time?: string;
      trailer_url?: unknown;
      actor?: string[];
      director?: string[];
      category?: { name: string; slug: string }[];
      country?: { name: string; slug: string }[];
    }) | undefined;
    if (!movie?.slug) return null;

    const detail: MovieDetail = {
      ...normalizeItem(movie),
      content: movie.content ?? "",
      time: movie.time ?? "",
      actor: movie.actor ?? [],
      director: movie.director ?? [],
      category: movie.category ?? [],
      country: movie.country ?? [],
      trailerUrl: str(movie.trailer_url) || null,
    };

    return {
      movie: detail,
      episodes: normalizeEpisodes(json.episodes),
    };
  });
}
