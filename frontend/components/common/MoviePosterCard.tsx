import Link from "next/link";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MovieListItem } from "@/lib/types";
import { PROVIDER_LABELS, type ProviderKey } from "@/lib/providers/types";
import { cn } from "@/lib/utils";

export function MoviePosterCard({ movie, priority = false }: { movie: MovieListItem; priority?: boolean }) {
  const sourceLabel = movie.source
    ? (PROVIDER_LABELS[movie.source as ProviderKey] ?? null)
    : null;

  return (
    <Link
      href={`/movies/${movie.slug}`}
      className="group block space-y-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/60">
        {movie.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.thumbUrl}
            alt={`Poster phim ${movie.name}`}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Play className="size-8 text-muted-foreground/40" aria-hidden />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Cột badge góc trên trái: chất lượng + nhãn nguồn */}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <Badge className="h-5 border-none bg-black/70 px-1.5 text-[10px] font-semibold text-white">
            {movie.quality}
          </Badge>
          {sourceLabel ? (
            <span className="rounded border border-white/15 bg-neutral-800/90 px-1.5 py-0.5 text-[10px] font-medium leading-none text-neutral-200 backdrop-blur-sm">
              {sourceLabel}
            </span>
          ) : null}
        </div>

        <Badge
          variant="secondary"
          className="absolute right-2 top-2 h-5 border-none bg-primary px-1.5 text-[10px] font-medium text-primary-foreground"
        >
          {movie.lang}
        </Badge>

        {movie.episodeTotal ? (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Tập {movie.episodeCurrent ?? "?"}/{movie.episodeTotal}
          </span>
        ) : null}

        <span
          aria-hidden
          className={cn(
            "absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100 group-focus-visible:opacity-100",
            "group-hover:translate-y-0 translate-y-1",
          )}
        >
          <Play className="size-4 fill-current" />
        </span>
      </div>

      <div className="space-y-0.5">
        <p className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
          {movie.name}
        </p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {[movie.originName, movie.year || null].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
      <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );
}
