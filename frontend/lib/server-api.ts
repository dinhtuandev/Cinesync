import "server-only";

import type { MovieDetailResponse, MovieListItem } from "./types";
import { MdpError, type NamedItem, type PagedMovies } from "./providers/base";
import { createKkphimProvider } from "./providers/kkphim";
import { createVsmovProvider } from "./providers/vsmov";
import type { ListType } from "./providers/types";

// ─── Fallback chain: VSMOV là PRIMARY, KKPhim là FALLBACK khi VSMOV sập ───
// - Provider fail (timeout/network/HTTP lỗi) → thử provider kế tiếp.
// - Lỗi programming/runtime khác được rethrow ngay, không nuốt.
// - Mỗi provider tự cache với key prefix riêng (`vsmov:`, `kkphim:`),
//   stale-on-error vẫn hoạt động ở tầng từng provider.

const PROVIDER_BASE_URLS = [
  process.env.MOVIE_PROVIDER_BASE_URL,
  process.env.MOVIE_PROVIDER_FALLBACK_URL,
].filter((url): url is string => Boolean(url));

const providers = PROVIDER_BASE_URLS.map((baseUrl, index) =>
  index === 0 ? createVsmovProvider(baseUrl) : createKkphimProvider(baseUrl),
);

if (!providers.length) {
  console.warn("MOVIE_PROVIDER_BASE_URL chưa cấu hình — dữ liệu phim sẽ không tải được");
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
