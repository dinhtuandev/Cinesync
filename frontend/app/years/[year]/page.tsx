import { Button } from "@/components/ui/button";
import { MovieGrid, Pagination } from "@/components/common/Browse";
import { MoviePosterCard } from "@/components/common/MoviePosterCard";
import { ErrorState } from "@/components/common/States";
import { getMoviesByYear } from "@/lib/server-api";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { year } = await params;
  return { title: `Phim năm ${year}` };
}

export default async function YearPage({ params, searchParams }: PageProps) {
  const { year } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  let data: Awaited<ReturnType<typeof getMoviesByYear>> | null = null;
  try {
    data = await getMoviesByYear(year, page);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <ErrorState
        className="mt-8"
        title="Không tải được danh sách phim"
        description="Nguồn dữ liệu đang gặp sự cố. Vui lòng thử lại sau."
        action={
          <Button variant="outline" size="sm" asChild>
            <a href={`/years/${year}`}>Thử lại</a>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <MovieGrid
        title={`Phim năm ${year}`}
        subtitle={data.totalPages > 1 ? `Trang ${data.page}/${data.totalPages}` : undefined}
      >
        {data.items.map((movie, i) => (
          <li key={movie.slug} className="list-none">
            <MoviePosterCard movie={movie} priority={page === 1 && i < 6} />
          </li>
        ))}
      </MovieGrid>
      <Pagination page={page} totalPages={data.totalPages} basePath={`/years/${year}`} />
    </>
  );
}
