import "server-only";

import type { MovieDetailResponse, MovieListItem } from "../types";
import {
  createFetcher,
  normalizeEpisodes,
  normalizeListItem,
  str,
  withCache,
  MdpError,
  type MovieProviderRawItem,
  type NamedItem,
  type PagedMovies,
} from "./base";
import type { ListType } from "./types";

/**
 * Provider VSMOV — PRIMARY.
 *
 * Đặc điểm response:
 * - Danh sách: `{ status, items[], pagination{currentPage,totalPages} }` ở top-level
 * - Chi tiết: `{ movie{...}, episodes[] }`
 * - Ảnh: URL tuyệt đối
 */

const IMAGE_CDN = ""; // VSMOV trả URL tuyệt đối, không cần CDN prefix

export function createVsmovProvider(baseUrl: string) {
  const get = createFetcher(baseUrl);
  const prefix = "vsmov";

  function toPaged(json: Record<string, unknown>): PagedMovies {
    const data = (json.data ?? {}) as Record<string, unknown>;
    const rawItems = (json.items ?? data.items ?? []) as MovieProviderRawItem[];
    const pagination = (json.pagination ?? data.pagination ?? null) as
      | { currentPage?: number; totalPages?: number }
      | null;
    return {
      items: rawItems.filter((i) => i?.slug).map((i) => normalizeListItem(i, IMAGE_CDN)),
      page: pagination?.currentPage ?? 1,
      totalPages: pagination?.totalPages ?? 1,
      source: prefix,
    };
  }

  function extractNamed(json: Record<string, unknown>): NamedItem[] {
    const data = (json.data ?? {}) as Record<string, unknown>;
    const items = (json.items ?? data.items ?? []) as { name?: unknown; slug?: unknown }[];
    return items
      .filter((i) => i?.slug && i?.name)
      .map((i) => ({ name: String(i.name), slug: String(i.slug) }));
  }

  return {
    name: prefix,

    async getList(type: ListType, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:list:${type}:${page}`, "list", async () =>
        toPaged(await get(`/danh-sach/${type}`, { page })),
      );
    },

    async search(keyword: string, limit: number): Promise<MovieListItem[]> {
      const kw = keyword.trim();
      if (kw.length < 2) return [];
      return withCache(`${prefix}:search:${kw.toLowerCase()}:${limit}`, "list", async () =>
        toPaged(await get("/tim-kiem", { keyword: kw, limit })).items,
      );
    },

    async getGenres(): Promise<NamedItem[]> {
      return withCache(`${prefix}:genres`, "detail", async () =>
        extractNamed(await get("/the-loai")),
      );
    },

    async getCountries(): Promise<NamedItem[]> {
      return withCache(`${prefix}:countries`, "detail", async () =>
        extractNamed(await get("/quoc-gia")),
      );
    },

    async getYears(): Promise<NamedItem[]> {
      return withCache(`${prefix}:years`, "detail", async () => extractNamed(await get("/nam")));
    },

    async getByGenre(slug: string, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:genre:${slug}:${page}`, "list", async () =>
        toPaged(await get(`/the-loai/${encodeURIComponent(slug)}`, { page })),
      );
    },

    async getByCountry(slug: string, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:country:${slug}:${page}`, "list", async () =>
        toPaged(await get(`/quoc-gia/${encodeURIComponent(slug)}`, { page })),
      );
    },

    async getByYear(year: string, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:year:${year}:${page}`, "list", async () =>
        toPaged(await get(`/nam/${encodeURIComponent(year)}`, { page })),
      );
    },

    async getDetail(
      slug: string,
      opts: { maxAgeMs?: number } = {},
    ): Promise<MovieDetailResponse | null> {
      return withCache(`${prefix}:detail:${slug}`, "detail", async () => {
        let json: Record<string, unknown>;
        try {
          json = await get(`/phim/${encodeURIComponent(slug)}`);
        } catch (error) {
          // 404 = phim không tồn tại trên provider này — không phải lỗi hệ thống
          if (error instanceof MdpError && error.message.includes("MDP 404")) return null;
          throw error;
        }
        const movie = json.movie as (MovieProviderRawItem & {
          content?: string;
          time?: string;
          trailer_url?: unknown;
          actor?: string[];
          director?: string[];
          category?: { name: string; slug: string }[];
          country?: { name: string; slug: string }[];
        }) | undefined;
        if (!movie?.slug) return null;

        const detail = {
          ...normalizeListItem(movie, IMAGE_CDN),
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
          source: prefix,
        };
      }, opts);
    },
  };
}
