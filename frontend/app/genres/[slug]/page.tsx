import { MovieGrid, Pagination } from "@/components/common/Browse";
import { getGenres, getMoviesByGenre } from "@/lib/server-api";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function GenrePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  let items: Awaited<ReturnType<typeof getMoviesByGenre>> | null = null;
  let title = slug;
  try {
    [items] = await Promise.all([
      getMoviesByGenre(slug, page),
      getGenres().then((genres) => {
        title = genres.find((g) => g.slug === slug)?.name ?? slug;
      }),
    ]);
  } catch {
    items = null;
  }

  return (
    <>
      <MovieGrid title={`Thể loại: ${title}`} movies={items?.items ?? []} />
      {items ? (
        <Pagination page={page} totalPages={items.totalPages} basePath={`/genres/${slug}`} />
      ) : null}
    </>
  );
}
