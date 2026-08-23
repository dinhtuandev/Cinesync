import "server-only";

import type { MovieDetail, MovieDetailResponse, MovieListItem } from "../types";
import {
  createFetcher,
  MdpError,
  normalizeEpisodes,
  normalizeListItem,
  str,
  withCache,
  type MovieProviderRawItem,
  type NamedItem,
  type PagedMovies,
} from "./base";
import { kkphimListType, type ListType } from "./types";

/**
 * Provider KKPhim — FALLBACK (dùng khi VSMOV sập).
 *
 * Lưu ý vận hành quan trọng:
 * - Domain web kkphim.com dùng WAF chặn IP nước ngoài (Âu/Mỹ/Nhật/Hàn) → 404.
 *   API hoạt động qua domain riêng phimapi.com.
 * - Vercel Functions mặc định chạy region US — nếu WAF chặn cả phimapi.com
 *   theo IP datacenter thì provider này sẽ fail ở production và fallback
 *   chain tự quay về VSMOV. Chọn Function Region gần VN (sin1) nếu muốn
 *   KKPhim hoạt động ổn định trên Vercel.
 *
 * Đặc điểm response khác VSMOV:
 * - Toàn bộ dữ liệu lồng trong `data`: `{ status, msg, data: { items[], params } }`
 * - Phân trang: `data.params.pagination{currentPage,totalPages}`
 * - Ảnh: đường dẫn tương đối → phải ghép `APP_DOMAIN_CDN_IMAGE` (phimimg.com)
 * - Chi tiết phim: `data.item` (episodes nằm ngay trong item)
 * - Không có endpoint danh sách năm phát hành
 */

const DEFAULT_IMAGE_CDN = "https://phimimg.com";
const EMPTY_PAGE = { items: [], page: 1, totalPages: 0 };

export function createKkphimProvider(baseUrl: string) {
  const get = createFetcher(baseUrl);
  const prefix = "kkphim";

  function toPaged(json: Record<string, unknown>): PagedMovies {
    const data = (json.data ?? {}) as Record<string, unknown>;
    const cdn = str(data.APP_DOMAIN_CDN_IMAGE) || DEFAULT_IMAGE_CDN;
    const rawItems = (data.items ?? []) as MovieProviderRawItem[];
    const params = (data.params ?? {}) as {
      pagination?: { currentPage?: number; totalPages?: number };
    };
    return {
      items: rawItems.filter((i) => i?.slug).map((i) => normalizeListItem(i, cdn, prefix)),
      page: params.pagination?.currentPage ?? 1,
      totalPages: params.pagination?.totalPages ?? 1,
      source: prefix,
    };
  }

  function extractNamed(json: Record<string, unknown>): NamedItem[] {
    const data = (json.data ?? {}) as Record<string, unknown>;
    const items = (data.items ?? []) as { name?: unknown; slug?: unknown }[];
    return items
      .filter((i) => i?.slug && i?.name)
      .map((i) => ({ name: String(i.name), slug: String(i.slug) }));
  }

  /** Loại danh sách không hỗ trợ → trả rỗng, KHÔNG throw để không kích hoạt fallback oan. */
  function unsupportedList(): PagedMovies {
    return { ...EMPTY_PAGE };
  }

  return {
    name: prefix,

    async getList(type: ListType, page: number): Promise<PagedMovies> {
      const mapped = kkphimListType(type);
      if (!mapped) return unsupportedList();
      return withCache(`${prefix}:list:${type}:${page}`, "list", async () =>
        toPaged(await get(`/v1/api/danh-sach/${mapped}`, { page })),
      );
    },

    async search(keyword: string, limit: number): Promise<MovieListItem[]> {
      const kw = keyword.trim();
      if (kw.length < 2) return [];
      return withCache(`${prefix}:search:${kw.toLowerCase()}:${limit}`, "list", async () =>
        toPaged(await get("/v1/api/tim-kiem", { keyword: kw, limit })).items,
      );
    },

    async getGenres(): Promise<NamedItem[]> {
      return withCache(`${prefix}:genres`, "detail", async () =>
        extractNamed(await get("/v1/api/the-loai")),
      );
    },

    async getCountries(): Promise<NamedItem[]> {
      return withCache(`${prefix}:countries`, "detail", async () =>
        extractNamed(await get("/v1/api/quoc-gia")),
      );
    },

    async getYears(): Promise<NamedItem[]> {
      // KKPhim không có endpoint danh sách năm — trả rỗng thay vì lỗi.
      return [];
    },

    async getByGenre(slug: string, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:genre:${slug}:${page}`, "list", async () =>
        toPaged(await get(`/v1/api/the-loai/${encodeURIComponent(slug)}`, { page })),
      );
    },

    async getByCountry(slug: string, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:country:${slug}:${page}`, "list", async () =>
        toPaged(await get(`/v1/api/quoc-gia/${encodeURIComponent(slug)}`, { page })),
      );
    },

    async getByYear(year: string, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:year:${year}:${page}`, "list", async () =>
        toPaged(await get(`/v1/api/nam/${encodeURIComponent(year)}`, { page })),
      );
    },

    async getDetail(
      slug: string,
      opts: { maxAgeMs?: number } = {},
    ): Promise<MovieDetailResponse | null> {
      return withCache(`${prefix}:detail:${slug}`, "detail", async () => {
        let json: Record<string, unknown>;
        try {
          json = await get(`/v1/api/phim/${encodeURIComponent(slug)}`);
        } catch (error) {
          if (error instanceof MdpError && error.message.includes("MDP 404")) return null;
          throw error;
        }
        const data = (json.data ?? {}) as Record<string, unknown>;
        const cdn = str(data.APP_DOMAIN_CDN_IMAGE) || DEFAULT_IMAGE_CDN;
        // Slug của provider khác nhau — chi tiết chỉ tồn tại trên provider gốc,
        // nên khi fallback sang KKPhim mà không thấy phim là hành vi bình thường.
        if (!json.status && !data.item) return null;
        const item = data.item as (MovieProviderRawItem & {
          content?: string;
          time?: string;
          trailer_url?: unknown;
          actor?: string[];
          director?: string[];
          category?: { name: string; slug: string }[];
          country?: { name: string; slug: string }[];
          episodes?: unknown;
        }) | undefined;
        if (!item?.slug) return null;

        const detail: MovieDetail = {
          ...normalizeListItem(item, cdn, prefix),
          content: item.content ?? "",
          time: item.time ?? "",
          actor: item.actor ?? [],
          director: item.director ?? [],
          category: item.category ?? [],
          country: item.country ?? [],
          trailerUrl: str(item.trailer_url) || null,
        };

        return {
          movie: detail,
          episodes: normalizeEpisodes(item.episodes),
          source: prefix,
        };
      }, opts);
    },
  };
}
