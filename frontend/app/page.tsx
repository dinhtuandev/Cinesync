import Link from "next/link";
import { Play, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const hero = sections[0]?.movies[0];

  return (
    <div className="space-y-10 pt-4 md:space-y-12 md:pt-6">
      {hero ? (
        <section
          aria-label={`Phim nổi bật: ${hero.name}`}
          className="relative overflow-hidden rounded-2xl ring-1 ring-border/60"
        >
          <div className="relative aspect-[4/3] w-full bg-card sm:aspect-[21/9] lg:aspect-[21/8]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero.thumbUrl}
              alt=""
              className="h-full w-full object-cover object-top"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 max-w-xl space-y-3 p-5 sm:p-8 lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Đề xuất hôm nay
              </p>
              <h1 className="text-xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                {hero.name}
              </h1>
              <p className="hidden text-sm text-neutral-300 sm:block">
                {[hero.originName, hero.year || null].filter(Boolean).join(" · ")}
              </p>
              <div className="flex flex-wrap gap-2 pt-1 sm:gap-3">
                <Button size="lg" className="rounded-full" asChild>
                  <Link href={`/movies/${hero.slug}/watch`}>
                    <Play aria-hidden /> Xem phim
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-neutral-500 bg-black/30 text-white backdrop-blur hover:bg-black/60 hover:text-white dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
                  asChild
                >
                  <Link href={`/movies/${hero.slug}`}>
                    <Users aria-hidden /> Xem cùng bạn bè
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sections.map((section) => {
        const moreType =
          section.title === "Mới cập nhật"
            ? "/movies?type=phim-moi-cap-nhat"
            : section.title === "Phim lẻ"
              ? "/movies?type=phim-le"
              : section.title === "Phim bộ"
                ? "/movies?type=phim-bo"
                : section.title === "Phim đang chiếu"
                  ? "/movies?type=dang-chieu"
                  : undefined;
        return (
          <MovieCarousel key={section.title} title={section.title} moreHref={moreType} movies={section.movies} />
        );
      })}
    </div>
  );
}
