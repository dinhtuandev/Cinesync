import "server-only";

import type { MovieDetailResponse, MovieListItem } from "./types";
import { MdpError, type NamedItem, type PagedMovies } from "./providers/base";
import { createKkphimProvider } from "./providers/kkphim";
import { createVsmovProvider } from "./providers/vsmov";
import { createVidsrcProvider } from "./providers/vidsrc";
import { SOURCE_ORDER, type ListType, type ProviderKey } from "./providers/types";

// ─── Multi-provider: VSMOV (1) + KKPhim (2) chạy song song,
// vidsrc (3, TMDB + embed) chỉ đăng ký khi có TMDB_API_KEY ───
// - Provider fail (timeout/network/HTTP lỗi) → thử provider kế tiếp.
// - Lỗi programming/runtime khác được rethrow ngay, không nuốt.
// - Mỗi provider tự cache với key prefix riêng, stale-on-error ở tầng provider.

const PROVIDER_BASE_URLS = [
  process.env.MOVIE_PROVIDER_BASE_URL,
  process.env.MOVIE_PROVIDER_FALLBACK_URL,
].filter((url): url is string => Boolean(url));

type ProviderInstance = ReturnType<typeof createVsmovProvider>;

const providers: ProviderInstance[] = [];
if (PROVIDER_BASE_URLS[0]) providers.push(createVsmovProvider(PROVIDER_BASE_URLS[0]));
if (PROVIDER_BASE_URLS[1]) providers.push(createKkphimProvider(PROVIDER_BASE_URLS[1]));
if (process.env.TMDB_API_KEY) {
  providers.push(
    createVidsrcProvider({
      tmdbBaseUrl: process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3",
      apiKey: process.env.TMDB_API_KEY,
      embedBaseUrl: process.env.VIDSRC_BASE_URL || "https://vidsrc.sbs",
    }),
  );
}

if (!providers.length) {
  console.warn("MOVIE_PROVIDER_BASE_URL chưa cấu hình — dữ liệu phim sẽ không tải được");
}

/** Số nguồn trên URL (?src=N) → provider key. Bỏ qua nguồn chưa đăng ký. */
export function sourceKeyFromNumber(src: string | undefined): ProviderKey | null {
  const n = Number(src);
  if (!Number.isInteger(n) || n < 1 || n > SOURCE_ORDER.length) return null;
  const key = SOURCE_ORDER[n - 1];
  return providers.some((p) => p.name === key) ? key : null;
}

export function sourceNumberOf(key: ProviderKey): number {
  return SOURCE_ORDER.indexOf(key) + 1;
}

async function withFallback<T>(fn: (provider: (typeof providers)[number]) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await fn(provider);
    } catch (error) {
      lastError = error;
      // Chỉ fallback cho lỗi upstream; lỗi khác rethrow ngay
      if (!(error instanceof MdpError)) throw error;
    }
  }
  throw lastError;
}
export type { ListType } from "./providers/types";
export { MOVIE_LIST_TYPES } from "./providers/types";
export type { NamedItem, PagedMovies } from "./providers/base";

export async function getMovieList(
  type: ListType = "phim-moi-cap-nhat",
  page = 1,
): Promise<PagedMovies> {
  return withFallback((p) => p.getList(type, page));
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
  const results = await withFallback((p) => p.search(keyword, limit));
  return results;
}

export async function getGenres(): Promise<NamedItem[]> {
  return withFallback((p) => p.getGenres());
}

export async function getCountries(): Promise<NamedItem[]> {
  return withFallback((p) => p.getCountries());
}

export async function getYears(): Promise<NamedItem[]> {
  return withFallback((p) => p.getYears());
}

export async function getMoviesByGenre(slug: string, page = 1): Promise<PagedMovies> {
  return withFallback((p) => p.getByGenre(slug, page));
}

export async function getMoviesByCountry(slug: string, page = 1): Promise<PagedMovies> {
  return withFallback((p) => p.getByCountry(slug, page));
}

export async function getMoviesByYear(year: string, page = 1): Promise<PagedMovies> {
  return withFallback((p) => p.getByYear(year, page));
}

export async function getMovieDetail(
  slug: string,
  opts: { maxAgeMs?: number } = {},
): Promise<MovieDetailResponse | null> {
  for (const provider of providers) {
    try {
      const detail = await provider.getDetail(slug, opts);
      if (detail) return detail;
      // null = phim không tồn tại trên provider này → thử provider kế tiếp
      // (slug không dùng chung giữa các provider, trừ khi trùng hợp hiếm)
      continue;
    } catch (error) {
      if (!(error instanceof MdpError)) throw error;
      // upstream fail → provider kế tiếp
    }
  }
  return null;
}

// ─── Multi-source: mọi nguồn đăng ký chạy song song ───
// - Trang chi tiết gộp server của tất cả nguồn.
// - Trang watch phát theo ?src=; nguồn hiện tại lỗi → UI đề xuất chuyển
//   nguồn còn lại (fallback chéo).

function providerByKey(key: string): ProviderInstance | undefined {
  return providers.find((p) => p.name === key);
}

/** Lấy chi tiết phim trực tiếp từ MỘT nguồn chỉ định (không fallback chain). */
export async function getMovieDetailFromSource(
  key: string,
  slugOnSource: string,
  opts: { maxAgeMs?: number } = {},
): Promise<MovieDetailResponse | null> {
  const provider = providerByKey(key);
  if (!provider) return null;
  try {
    return await provider.getDetail(slugOnSource, opts);
  } catch {
    return null;
  }
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Tìm slug tương đương của cùng một phim trên nguồn khác bằng cách so
 * tên gốc/tên tiếng Việt + năm phát hành. Trả null nếu không tìm thấy.
 */
async function findCounterpartSlug(
  targetKey: string,
  ref: { name: string; originName: string; year: number },
): Promise<string | null> {
  const provider = providerByKey(targetKey);
  if (!provider) return null;

  const queries = [ref.originName, ref.name].filter(Boolean);
  for (const query of queries) {
    try {
      const candidates = await provider.search(query, 10);
      const target = normalizeTitle(ref.originName || ref.name);
      const match =
        candidates.find((c) => {
          const cand = normalizeTitle(c.originName || c.name);
          return target.length >= 4 && (cand.includes(target) || target.includes(cand));
        }) ??
        candidates.find(
          (c) =>
            Math.abs((c.year || 0) - (ref.year || 0)) <= 1 &&
            normalizeTitle(c.name) === normalizeTitle(ref.name),
        );
      if (match) return match.slug;
    } catch {
      /* nguồn kia lỗi — bỏ qua */
    }
  }
  return null;
}

/** Tìm slug của cùng phim trên nguồn chỉ định (dùng cho fallback chéo). */
export async function findMovieOnSource(
  targetKey: string,
  ref: { name: string; originName: string; year: number },
): Promise<string | null> {
  return findCounterpartSlug(targetKey, ref);
}

export interface SourceDetail {
  key: ProviderKey;
  slugOnSource: string;
  detail: MovieDetailResponse;
}

export interface AggregatedDetail {
  /** Key của nguồn chứa `primary` (thường là nguồn 1) */
  primaryKey: ProviderKey;
  primary: MovieDetailResponse | null;
  /** Chi tiết từ các nguồn còn lại (đối chiếu theo tên/năm) */
  others: SourceDetail[];
}

/**
 * Gộp chi tiết phim từ TẤT CẢ nguồn đăng ký chạy song song. Nguồn phụ
 * được dò bằng tìm kiếm tiêu đề; lỗi ở nguồn phụ không ảnh hưởng nguồn chính.
 */
export async function getAggregatedMovieDetail(
  slug: string,
  opts: { maxAgeMs?: number } = {},
): Promise<AggregatedDetail> {
  const primaryKey: ProviderKey = (providers[0]?.name as ProviderKey) ?? "vsmov";
  let primary: MovieDetailResponse | null = null;
  try {
    primary = await providers[0]?.getDetail(slug, opts) ?? null;
  } catch {
    primary = null;
  }

  const reference = primary?.movie ?? null;
  if (!reference) {
    // Nguồn chính không có phim → thử lần lượt nguồn còn lại theo slug gốc
    for (const provider of providers.slice(1)) {
      try {
        const direct = await provider.getDetail(slug, opts);
        if (direct) {
          return {
            primaryKey: provider.name as ProviderKey,
            primary: direct,
            others: [],
          };
        }
      } catch {
        /* bỏ qua */
      }
    }
    return { primaryKey, primary: null, others: [] };
  }

  const ref = { name: reference.name, originName: reference.originName, year: reference.year };

  // Dò các nguồn còn lại song song
  const others = await Promise.all(
    providers
      .filter((p) => p.name !== primaryKey)
      .map(async (provider) => {
        const key = provider.name as ProviderKey;
        try {
          const slugOnSource = await findCounterpartSlug(key, ref);
          if (!slugOnSource) return null;
          const detail = await provider.getDetail(slugOnSource, opts);
          if (!detail || detail.episodes.length === 0) return null;
          return { key, slugOnSource, detail } satisfies SourceDetail;
        } catch {
          return null;
        }
      }),
  );

  return {
    primaryKey,
    primary,
    others: others.filter((o): o is SourceDetail => o !== null),
  };
}
