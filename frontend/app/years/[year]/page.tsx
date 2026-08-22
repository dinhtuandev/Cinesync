import { MovieGrid, Pagination } from "@/components/common/Browse";
import { getMoviesByYear } from "@/lib/server-api";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function YearPage({ params, searchParams }: PageProps) {
  const { year } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  let items: Awaited<ReturnType<typeof getMoviesByYear>> | null = null;
  try {
    items = await getMoviesByYear(year, page);
  } catch {
    items = null;
  }

  return (
    <>
      <MovieGrid title={`Phim năm ${year}`} movies={items?.items ?? []} />
      {items ? (
        <Pagination page={page} totalPages={items.totalPages} basePath={`/years/${year}`} />
      ) : null}
    </>
  );
}
