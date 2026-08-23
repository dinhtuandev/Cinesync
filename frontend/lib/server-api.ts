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

// ─── Multi-source: cả 2 nguồn chạy song song ───
// - Trang chi tiết gộp server của cả 2 nguồn.
// - Trang watch phát theo ?src=; nguồn hiện tại lỗi → UI đề xuất chuyển
//   nguồn còn lại (fallback chéo).

type ProviderInstance = ReturnType<typeof createVsmovProvider>;

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

export interface AggregatedDetail {
  /** Chi tiết từ Nguồn 1 theo slug gốc */
  primary: MovieDetailResponse | null;
  /** Chi tiết từ Nguồn 2 (phim khớp theo tên/năm), kèm slug trên nguồn đó */
  secondary: MovieDetailResponse | null;
  secondarySlug: string | null;
}

/**
 * Gộp chi tiết phim từ cả 2 nguồn chạy song song. Nguồn phụ được dò bằng
 * tìm kiếm tiêu đề; mọi lỗi ở nguồn phụ không ảnh hưởng nguồn chính.
 */
export async function getAggregatedMovieDetail(
  slug: string,
  opts: { maxAgeMs?: number } = {},
): Promise<AggregatedDetail> {
  let primary: MovieDetailResponse | null = null;
  try {
    primary = await providers[0]?.getDetail(slug, opts) ?? null;
  } catch {
    primary = null;
  }

  const fallbackProvider = providers[1];
  if (!fallbackProvider) return { primary, secondary: null, secondarySlug: null };

  // Nếu nguồn chính không có phim → thử đối chiếu ngược từ fallback lên chính
  const reference = primary?.movie ?? null;
  let secondarySlug: string | null = null;

  if (!reference) {
    // Thử lấy trực tiếp từ nguồn phụ theo slug (hiếm khi trùng nhưng rẻ)
    try {
      const direct = await fallbackProvider.getDetail(slug, opts);
      if (direct) return { primary: direct, secondary: null, secondarySlug: null };
    } catch {
      /* bỏ qua */
    }
    return { primary: null, secondary: null, secondarySlug: null };
  }

  secondarySlug = await findCounterpartSlug(fallbackProvider.name, {
    name: reference.name,
    originName: reference.originName,
    year: reference.year,
  });

  let secondary: MovieDetailResponse | null = null;
  if (secondarySlug) {
    try {
      secondary = await fallbackProvider.getDetail(secondarySlug, opts);
    } catch {
      secondary = null;
    }
  }

  return { primary, secondary, secondarySlug };
}
