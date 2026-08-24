/**
 * Loại danh sách mà từng provider hỗ trợ.
 * Provider không hỗ trợ loại nào sẽ trả danh sách rỗng (graceful),
 * không coi là lỗi để fallback chain không bị kích hoạt oan.
 */

export const VSMOV_LIST_TYPES = [
  "phim-moi-cap-nhat",
  "phim-le",
  "phim-bo",
  "long-tieng",
  "thuyet-minh",
  "dang-chieu",
  "phim-chieu-rap",
  "4k",
] as const satisfies readonly string[];

export type ListType = (typeof VSMOV_LIST_TYPES)[number];

/**
 * Nhãn nguồn hiển thị cho người dùng — KHÔNG lộ tên/domain provider thật.
 * Nguồn 1 = primary (VSMOV), Nguồn 2 = fallback (KKPhim),
 * Nguồn 3 = TMDB catalog + embed player (vidsrc) — chỉ bật khi có TMDB_API_KEY.
 */
export type ProviderKey = "vsmov" | "kkphim" | "vidsrc";

export const PROVIDER_LABELS: Record<ProviderKey, string> = {
  vsmov: "Nguồn 1",
  kkphim: "Nguồn 2",
  vidsrc: "Nguồn 3",
};

/** Thứ tự nguồn — index + 1 = số nguồn trên URL (?src=1|2|3) */
export const SOURCE_ORDER: ProviderKey[] = ["vsmov", "kkphim", "vidsrc"];

/** KKPhim chỉ có 1 nhóm danh sách tương ứng; còn lại trả rỗng. */
const KKPHIM_LIST_TYPE_MAP: Partial<Record<ListType, string>> = {
  "phim-moi-cap-nhat": "phim-moi-cap-nhat",
  "phim-le": "phim-le",
  "phim-bo": "phim-bo",
  "dang-chieu": "phim-dang-chieu",
};

export const MOVIE_LIST_TYPES = VSMOV_LIST_TYPES;

export function kkphimListType(type: ListType): string | null {
  return KKPHIM_LIST_TYPE_MAP[type] ?? null;
}
