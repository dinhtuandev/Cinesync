import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MovieGrid, Pagination } from "@/components/common/Browse";
import { MoviePosterCard } from "@/components/common/MoviePosterCard";
import { ErrorState } from "@/components/common/States";
import { MOVIE_LIST_TYPES, getMovieList, type ListType } from "@/lib/server-api";

export const revalidate = 900;

const TAB_LABELS: Record<ListType, string> = {
  "phim-moi-cap-nhat": "Mới cập nhật",
  "phim-le": "Phim lẻ",
  "phim-bo": "Phim bộ",
  "long-tieng": "Lồng tiếng",
  "thuyet-minh": "Thuyết minh",
  "dang-chieu": "Đang chiếu",
  "phim-chieu-rap": "Chiếu rạp",
  "4k": "Phim 4K",
};

interface PageProps {
  searchParams: Promise<{ type?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps) {
  const { type } = await searchParams;
  const label = TAB_LABELS[type as ListType] ?? "Danh sách phim";
  return { title: label };
}

export default async function MoviesPage({ searchParams }: PageProps) {
  const { type: typeParam, page: pageParam } = await searchParams;
  const activeType = (MOVIE_LIST_TYPES as readonly string[]).includes(typeParam ?? "")
    ? (typeParam as ListType)
    : "phim-moi-cap-nhat";
  const page = Math.max(1, Number(pageParam) || 1);

  let data: Awaited<ReturnType<typeof getMovieList>> | null = null;
  try {
    data = await getMovieList(activeType, page);
  } catch {
    data = null;
  }

  const basePath = `/movies?type=${activeType}`;

  return (
    <div className="pt-4 md:pt-6">
      <nav aria-label="Danh mục phim" className="border-b border-border pb-4">
        <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MOVIE_LIST_TYPES.map((type) => (
            <li key={type}>
              <Button
                variant={type === activeType ? "default" : "secondary"}
                size="sm"
                className="shrink-0 rounded-full"
                asChild
              >
                <Link href={`/movies?type=${type}`} aria-current={type === activeType ? "page" : undefined}>
                  {TAB_LABELS[type]}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </nav>

      {data ? (
        <>
          <MovieGrid
            title={TAB_LABELS[activeType]}
            subtitle={
              data.totalPages > 1
                ? `Trang ${data.page}/${data.totalPages}`
                : undefined
            }
          >
            {data.items.map((movie, i) => (
              <li key={movie.slug} className="list-none">
                <MoviePosterCard movie={movie} priority={page === 1 && i < 6} />
              </li>
            ))}
          </MovieGrid>
          <Pagination page={page} totalPages={data.totalPages} basePath={basePath} />
        </>
      ) : (
        <ErrorState
          title="Không tải được danh sách phim"
          description="Nguồn dữ liệu phim đang gặp sự cố. Vui lòng thử lại sau ít phút."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/">Về trang chủ</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
