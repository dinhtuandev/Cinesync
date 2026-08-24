import "server-only";

import type { MovieDetail, MovieDetailResponse, MovieListItem, EpisodeServer } from "../types";
import { createFetcher, MdpError, str, withCache, type NamedItem, type PagedMovies } from "./base";
import type { ListType } from "./types";

/**
 * Provider vidsrc (Nguồn 3) — catalog TMDB + embed player theo tmdb_id.
 *
 * Kiến trúc khác 2 nguồn còn lại:
 * - Metadata lấy từ TMDB API (cần TMDB_API_KEY — server-only)
 * - Playback: iframe embed `https://vidsrc.sbs/embed/movie/{id}` hoặc
 *   `/embed/tv/{id}/{season}/{episode}` (X-Frame-Options: ALLOWALL)
 * - Slug nội bộ: `tmdb-{movie|tv}-{id}` — dùng làm eslug khi watch ?src=3
 * - Không có endpoint quốc gia/danh sách năm → trả rỗng (graceful)
 */

const TMDB_IMAGE = "https://image.tmdb.org/t/p";

const EMPTY_PAGE: PagedMovies = { items: [], page: 1, totalPages: 0, source: "vidsrc" };

interface TmdbResult {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
}

export function createVidsrcProvider(opts: {
  tmdbBaseUrl: string;
  apiKey: string;
  embedBaseUrl: string;
}) {
  const { tmdbBaseUrl, apiKey, embedBaseUrl } = opts;
  const prefix = "vidsrc";
  const rawGet = createFetcher(tmdbBaseUrl);
  const get = (path: string, params: Record<string, string | number> = {}) =>
    rawGet(path, { ...params, api_key: apiKey });

  function imgUrl(path: string | null | undefined, size: string): string {
    return path ? `${TMDB_IMAGE}/${size}${path}` : "";
  }

  function yearOf(r: TmdbResult): number {
    const date = r.release_date ?? r.first_air_date ?? "";
    return Number(date.slice(0, 4)) || 0;
  }

  function normalizeItem(r: TmdbResult, mediaType: "movie" | "tv"): MovieListItem {
    return {
      slug: `tmdb-${mediaType}-${r.id}`,
      name: r.title ?? r.name ?? "",
      originName: r.original_title ?? r.original_name ?? "",
      posterUrl: imgUrl(r.backdrop_path, "w780") || imgUrl(r.poster_path, "w780"),
      thumbUrl: imgUrl(r.poster_path, "w342"),
      year: yearOf(r),
      quality: "HD",
      lang: "Vietsub",
      source: prefix,
    };
  }

  function toPaged(json: Record<string, unknown>): PagedMovies {
    const results = (json.results ?? []) as TmdbResult[];
    const items = results
      .filter((r) => r.id && (r.title || r.name))
      .filter((r) => !r.media_type || r.media_type === "movie" || r.media_type === "tv")
      .map((r) => normalizeItem(r, r.media_type === "tv" ? "tv" : "movie"));
    const totalPages = Math.min(Number(json.total_pages) || 1, 500); // TMDB cap 500
    return { items, page: Number(json.page) || 1, totalPages, source: prefix };
  }

  function extractGenres(json: Record<string, unknown>): NamedItem[] {
    const genres = (json.genres ?? []) as { id: number; name: string }[];
    return genres.map((g) => ({ name: g.name, slug: String(g.id) }));
  }

  function embedMovieUrl(id: number): string {
    return `${embedBaseUrl}/embed/movie/${id}`;
  }

  function embedTvUrl(id: number, season: number, episode: number): string {
    return `${embedBaseUrl}/embed/tv/${id}/${season}/${episode}`;
  }

  return {
    name: prefix,

    async getList(type: ListType, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:list:${type}:${page}`, "list", async () => {
        switch (type) {
          case "phim-moi-cap-nhat":
            return toPaged(await get("/trending/all/week", { page }));
          case "phim-le":
            return toPaged(
              await get("/discover/movie", { page, sort_by: "popularity.desc" }),
            );
          case "phim-bo":
            return toPaged(await get("/discover/tv", { page, sort_by: "popularity.desc" }));
          // Các loại lồng tiếng/thuyết minh/đang chiếu/4K — TMDB không map trực tiếp
          default:
            return { ...EMPTY_PAGE };
        }
      });
    },

    async search(keyword: string, limit: number): Promise<MovieListItem[]> {
      const kw = keyword.trim();
      if (kw.length < 2) return [];
      return withCache(`${prefix}:search:${kw.toLowerCase()}:${limit}`, "list", async () => {
        const json = (await get("/search/multi", { query: kw, page: 1 })) as Record<string, unknown>;
        return toPaged(json).items.slice(0, limit);
      });
    },

    async getGenres(): Promise<NamedItem[]> {
      return withCache(`${prefix}:genres`, "detail", async () =>
        extractGenres(await get("/genre/movie/list")),
      );
    },

    async getCountries(): Promise<NamedItem[]> {
      return [];
    },

    async getYears(): Promise<NamedItem[]> {
      return [];
    },

    async getByGenre(slug: string, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:genre:${slug}:${page}`, "list", async () =>
        toPaged(await get("/discover/movie", { page, with_genres: slug })),
      );
    },

    async getByCountry(): Promise<PagedMovies> {
      return { ...EMPTY_PAGE };
    },

    async getByYear(year: string, page: number): Promise<PagedMovies> {
      return withCache(`${prefix}:year:${year}:${page}`, "list", async () =>
        toPaged(await get("/discover/movie", { page, primary_release_year: year })),
      );
    },

    async getDetail(
      slug: string,
      opts: { maxAgeMs?: number } = {},
    ): Promise<MovieDetailResponse | null> {
      return withCache(`${prefix}:detail:${slug}`, "detail", async () => {
        const match = /^tmdb-(movie|tv)-(\d+)$/.exec(slug);
        if (!match) return null;
        const mediaType = match[1] as "movie" | "tv";
        const id = Number(match[2]);

        let json: Record<string, unknown>;
        try {
          json = await get(`/${mediaType}/${id}`, { append_to_response: "videos" });
        } catch (error) {
          if (error instanceof MdpError && error.message.includes("MDP 404")) return null;
          throw error;
        }

        const title = str(json.title) || str(json.name);
        if (!title) return null;

        const runtime = Number(json.runtime) || Number((json.episode_run_time as number[] | undefined)?.[0]) || 0;
        const videos = (json.videos ?? {}) as {
          results?: { key?: string; site?: string; type?: string }[];
        };
        const trailer = videos.results?.find((v) => v.site === "YouTube" && v.type === "Trailer");

        const detail: MovieDetail = {
          slug,
          name: title,
          originName: str(json.original_title) || str(json.original_name),
          posterUrl: imgUrl(json.backdrop_path as string, "w780") || imgUrl(json.poster_path as string, "w780"),
          thumbUrl: imgUrl(json.poster_path as string, "w342"),
          year: yearOf(json as unknown as TmdbResult),
          quality: "HD",
          lang: "Vietsub",
          source: prefix,
          content: str(json.overview),
          time: runtime ? String(runtime) : "",
          actor: [],
          director: [],
          category: [],
          country: [],
          trailerUrl: trailer?.key ? `https://www.youtube.com/embed/${trailer.key}` : null,
        };

        let episodes: EpisodeServer[] = [];
        if (mediaType === "movie") {
          episodes = [
            {
              serverName: "Embed · Nguồn 3",
              serverData: [
                { name: "Full", slug: "full", linkEmbed: embedMovieUrl(id), linkM3u8: null },
              ],
            },
          ];
        } else {
          // TV: lấy season 1 làm danh sách tập (đủ để xem; các season sau mở rộng sau)
          try {
            const season = (await get(`/tv/${id}/season/1`)) as {
              episodes?: { episode_number?: number; name?: string }[];
            };
            const eps = (season.episodes ?? []).filter((e) => e.episode_number);
            if (eps.length) {
              episodes = [
                {
                  serverName: "Embed · Nguồn 3 · Season 1",
                  serverData: eps.map((e) => ({
                    name: e.name || `Tập ${e.episode_number}`,
                    slug: `s1e${e.episode_number}`,
                    linkEmbed: embedTvUrl(id, 1, e.episode_number!),
                    linkM3u8: null,
                  })),
                },
              ];
            }
          } catch {
            /* không lấy được season — phim vẫn hiện nhưng không có tập */
          }
        }

        return { movie: detail, episodes, source: prefix };
      }, opts);
    },
  };
}

