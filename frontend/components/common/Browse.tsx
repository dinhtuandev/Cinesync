import Link from "next/link";
import type { MovieListItem } from "@/lib/types";
import { MoviePosterCard } from "./MoviePosterCard";

export function MovieGrid({
  title,
  movies,
}: {
  title: string;
  movies: MovieListItem[];
}) {
  return (
    <div className="space-y-4 pt-6">
      <h1 className="text-lg font-semibold text-neutral-100">{title}</h1>
      {movies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-700 p-10 text-center">
          <p className="text-sm text-neutral-400">Không tìm thấy phim phù hợp</p>
          <Link href="/" className="mt-3 inline-block text-sm text-rose-500 hover:text-rose-400">
            ← Về trang chủ
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {movies.map((movie) => (
            <MoviePosterCard key={movie.slug} movie={movie} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  const pages = [page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages);

  return (
    <nav className="flex items-center justify-center gap-2 pt-8">
      {page > 1 ? (
        <Link
          href={`${basePath}?page=${page - 1}`}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-rose-600 hover:text-white"
        >
          ← Trước
        </Link>
      ) : null}
      {pages.map((p) => (
        <Link
          key={p}
          href={`${basePath}?page=${p}`}
          className={`rounded-lg border px-4 py-2 text-sm ${
            p === page
              ? "border-rose-600 bg-rose-600 text-white"
              : "border-neutral-700 text-neutral-300 hover:border-rose-600 hover:text-white"
          }`}
        >
          {p}
        </Link>
      ))}
      {page < totalPages ? (
        <Link
          href={`${basePath}?page=${page + 1}`}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-rose-600 hover:text-white"
        >
          Sau →
        </Link>
      ) : null}
    </nav>
  );
}

export function ChipList({
  heading,
  items,
  basePath,
}: {
  heading: string;
  items: { name: string; slug: string }[];
  basePath: string;
}) {
  return (
    <div className="space-y-4 pt-6">
      <h1 className="text-lg font-semibold text-neutral-100">{heading}</h1>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={`${basePath}/${item.slug}`}
            className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-sm text-neutral-300 transition hover:border-rose-600 hover:text-white"
          >
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
