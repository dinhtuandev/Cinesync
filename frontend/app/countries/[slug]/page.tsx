import { MovieGrid, Pagination } from "@/components/common/Browse";
import { getCountries, getMoviesByCountry } from "@/lib/server-api";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function CountryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  let items: Awaited<ReturnType<typeof getMoviesByCountry>> | null = null;
  let title = slug;
  try {
    [items] = await Promise.all([
      getMoviesByCountry(slug, page),
      getCountries().then((countries) => {
        title = countries.find((c) => c.slug === slug)?.name ?? slug;
      }),
    ]);
  } catch {
    items = null;
  }

  return (
    <>
      <MovieGrid title={`Quốc gia: ${title}`} movies={items?.items ?? []} />
      {items ? (
        <Pagination page={page} totalPages={items.totalPages} basePath={`/countries/${slug}`} />
      ) : null}
    </>
  );
}
