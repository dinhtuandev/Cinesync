import Link from "next/link";
import type { MovieListItem } from "@/lib/types";

export function MoviePosterCard({ movie }: { movie: MovieListItem }) {
  return (
    <Link href={`/movies/${movie.slug}`} className="group block space-y-2">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-neutral-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={movie.thumbUrl}
          alt={movie.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {movie.quality}
        </span>
        <span className="absolute right-1.5 top-1.5 rounded bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {movie.lang}
        </span>
        {movie.episodeTotal ? (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
            Tập {movie.episodeCurrent}/{movie.episodeTotal}
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5">
        <p className="line-clamp-1 text-sm font-medium text-neutral-100 group-hover:text-rose-500">
          {movie.name}
        </p>
        <p className="text-xs text-neutral-400">
          {movie.originName} · {movie.year}
        </p>
      </div>
    </Link>
  );
}
