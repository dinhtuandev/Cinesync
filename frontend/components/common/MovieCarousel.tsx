"use client";

import { useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./Browse";
import { MoviePosterCard, MovieCardSkeleton } from "./MoviePosterCard";
import type { MovieListItem } from "@/lib/types";

export function MovieCarousel({
  title,
  moreHref,
  movies,
}: {
  title: string;
  moreHref?: string;
  movies: MovieListItem[];
}) {
  const scrollerRef = useRef<HTMLUListElement>(null);

  const scrollByAmount = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  }, []);

  if (!movies.length) return null;

  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader title={title} moreHref={moreHref} />
        <div className="hidden shrink-0 gap-1 md:flex">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => scrollByAmount(-1)}
            aria-label={`Cuộn ${title} sang trái`}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => scrollByAmount(1)}
            aria-label={`Cuộn ${title} sang phải`}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <ul
        ref={scrollerRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
      >
        {movies.map((movie) => (
          <li key={movie.slug} className="w-36 shrink-0 snap-start sm:w-40 lg:w-44 xl:w-48">
            <MoviePosterCard movie={movie} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MovieCarouselSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-36 shrink-0 sm:w-40 lg:w-44 xl:w-48">
            <MovieCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
