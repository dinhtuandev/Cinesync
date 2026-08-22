import { Button } from "@/components/ui/button";
import { MovieGrid, Pagination } from "@/components/common/Browse";
import { MoviePosterCard } from "@/components/common/MoviePosterCard";
import { ErrorState } from "@/components/common/States";
import { getCountries, getMoviesByCountry } from "@/lib/server-api";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return { title: `Phim ${decodeURIComponent(slug)}` };
}

export default async function CountryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  let data: Awaited<ReturnType<typeof getMoviesByCountry>> | null = null;
  let countryName = decodeURIComponent(slug);
  try {
    [data] = await Promise.all([
      getMoviesByCountry(slug, page),
      getCountries().then((countries) => {
        const match = countries.find((c) => c.slug === slug);
        if (match) countryName = match.name;
      }),
    ]);
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
            <a href={`/countries/${slug}`}>Thử lại</a>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <MovieGrid
        title={`Quốc gia: ${countryName}`}
        subtitle={data.totalPages > 1 ? `Trang ${data.page}/${data.totalPages}` : undefined}
      >
        {data.items.map((movie, i) => (
          <li key={movie.slug} className="list-none">
            <MoviePosterCard movie={movie} priority={page === 1 && i < 6} />
          </li>
        ))}
      </MovieGrid>
      <Pagination page={page} totalPages={data.totalPages} basePath={`/countries/${slug}`} />
    </>
  );
}
