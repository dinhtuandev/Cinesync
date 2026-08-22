import type { MovieListItem } from "@/lib/types";
import { MoviePosterCard } from "./MoviePosterCard";

export function MovieCarousel({ title, movies }: { title: string; movies: MovieListItem[] }) {
  if (!movies.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
        {movies.map((movie) => (
          <div key={movie.slug} className="w-36 shrink-0 snap-start sm:w-44 lg:w-48">
            <MoviePosterCard movie={movie} />
          </div>
        ))}
      </div>
    </section>
  );
}
