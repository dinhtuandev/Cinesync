import Link from "next/link";
import { MovieGrid, Pagination } from "@/components/common/Browse";
import { getMovieList, type ListType } from "@/lib/server-api";

export const revalidate = 900;

const TABS: { label: string; type: ListType }[] = [
  { label: "Mới cập nhật", type: "phim-moi-cap-nhat" },
  { label: "Phim lẻ", type: "phim-le" },
  { label: "Phim bộ", type: "phim-bo" },
  { label: "Lồng tiếng", type: "long-tieng" },
  { label: "Thuyết minh", type: "thuyet-minh" },
  { label: "Đang chiếu", type: "dang-chieu" },
  { label: "Chiếu rạp", type: "phim-chieu-rap" },
  { label: "Phim 4K", type: "4k" },
];

interface PageProps {
  searchParams: Promise<{ type?: string; page?: string }>;
}

export default async function MoviesPage({ searchParams }: PageProps) {
  const { type: typeParam, page: pageParam } = await searchParams;
  const activeType = (TABS.find((t) => t.type === typeParam)?.type ??
    "phim-moi-cap-nhat") as ListType;
  const page = Math.max(1, Number(pageParam) || 1);

  let items: Awaited<ReturnType<typeof getMovieList>> | null = null;
  try {
    items = await getMovieList(activeType, page);
  } catch {
    items = null;
  }

  return (
    <div className="pt-6">
      <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-4">
        {TABS.map((tab) => (
          <Link
            key={tab.type}
            href={`/movies?type=${tab.type}`}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              tab.type === activeType
                ? "bg-rose-600 font-medium text-white"
                : "border border-neutral-700 text-neutral-300 hover:border-rose-600 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <MovieGrid
          title={TABS.find((t) => t.type === activeType)?.label ?? ""}
          movies={items?.items ?? []}
        />
        {items ? (
          <Pagination page={page} totalPages={items.totalPages} basePath={`/movies?type=${activeType}`} />
        ) : null}
      </div>
    </div>
  );
}
