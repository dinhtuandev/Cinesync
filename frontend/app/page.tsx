import { MovieCarousel } from "@/components/common/MovieCarousel";
import { getHomeSections } from "@/lib/server-api";

export const revalidate = 900;

export default async function HomePage() {
  let sections: Awaited<ReturnType<typeof getHomeSections>> = [];
  try {
    sections = await getHomeSections();
  } catch {
    sections = [];
  }

  if (!sections.length) {
    return (
      <div className="pt-16 text-center text-neutral-400">
        Không thể tải dữ liệu phim lúc này, vui lòng thử lại sau
      </div>
    );
  }

  const hero = sections[0]?.movies[0];

  return (
    <div className="space-y-10 pt-6">
      {hero ? (
        <section className="relative overflow-hidden rounded-2xl">
          <div className="relative aspect-[21/9] w-full bg-neutral-900 sm:aspect-[21/7]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.thumbUrl} alt={hero.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            <div className="absolute bottom-0 left-0 max-w-xl space-y-3 p-6 sm:p-10">
              <h1 className="text-2xl font-bold text-white sm:text-4xl">{hero.name}</h1>
              <p className="hidden text-sm text-neutral-300 sm:block">
                {hero.originName} · {hero.year} · {hero.quality}
              </p>
              <div className="flex gap-3">
                <a
                  href={`/movies/${hero.slug}`}
                  className="rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                >
                  Xem phim
                </a>
                <button
                  type="button"
                  className="rounded-full border border-neutral-500 bg-black/30 px-6 py-2 text-sm font-semibold text-white transition hover:bg-black/60"
                >
                  Xem cùng bạn bè
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sections.map((section) => (
        <MovieCarousel key={section.title} title={section.title} movies={section.movies} />
      ))}
    </div>
  );
}
