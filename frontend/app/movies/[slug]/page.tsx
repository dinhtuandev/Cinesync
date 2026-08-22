import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMovieDetail } from "@/lib/server-api";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getMovieDetail(slug);
  return { title: data ? `${data.movie.name} — CineSync` : "Không tìm thấy phim" };
}

export default async function MovieDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getMovieDetail(slug);
  if (!data) notFound();

  const { movie, episodes } = data;

  return (
    <div className="pt-6">
      <section className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={movie.posterUrl}
            alt=""
            className="h-full w-full object-cover opacity-20 blur-sm"
          />
        </div>
        <div className="relative flex flex-col gap-6 bg-neutral-950/60 p-6 sm:flex-row sm:p-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={movie.thumbUrl}
            alt={movie.name}
            className="w-40 shrink-0 self-center rounded-xl object-cover shadow-lg sm:self-start"
          />
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">{movie.name}</h1>
              <p className="text-sm text-neutral-400">{movie.originName}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-rose-600 px-2 py-0.5 font-semibold text-white">
                {movie.quality}
              </span>
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200">{movie.lang}</span>
              {movie.year ? (
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200">{movie.year}</span>
              ) : null}
              {movie.episodeTotal ? (
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200">
                  Tập {movie.episodeCurrent ?? "?"}/{movie.episodeTotal}
                </span>
              ) : null}
              {movie.time ? (
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200">{movie.time} phút</span>
              ) : null}
            </div>
            {movie.content ? (
              <p className="max-w-2xl text-sm leading-relaxed text-neutral-300">{movie.content}</p>
            ) : null}
            {movie.director.length ? (
              <p className="text-xs text-neutral-400">
                <span className="text-neutral-500">Đạo diễn:</span> {movie.director.join(", ")}
              </p>
            ) : null}
            {movie.actor.length ? (
              <p className="text-xs text-neutral-400">
                <span className="text-neutral-500">Diễn viên:</span> {movie.actor.slice(0, 6).join(", ")}
                {movie.actor.length > 6 ? "..." : ""}
              </p>
            ) : null}
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
              <span className="text-neutral-500">Thể loại:</span>
              {movie.category.map((c) => (
                <Link
                  key={c.slug}
                  href={`/genres/${c.slug}`}
                  className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-300 hover:text-white"
                >
                  {c.name}
                </Link>
              ))}
              {movie.country.map((c) => (
                <Link
                  key={c.slug}
                  href={`/countries/${c.slug}`}
                  className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-300 hover:text-white"
                >
                  {c.name}
                </Link>
              ))}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={`/movies/${movie.slug}/watch`}
                className="rounded-full bg-rose-600 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Xem phim
              </a>
              <button
                type="button"
                className="rounded-full border border-neutral-600 px-5 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
              >
                ♥ Yêu thích
              </button>
              <button
                type="button"
                className="rounded-full border border-neutral-600 px-5 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
              >
                ⏱ Xem sau
              </button>
              <button
                type="button"
                className="rounded-full border border-neutral-600 px-5 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
              >
                👥 Xem cùng bạn bè
              </button>
            </div>
          </div>
        </div>
      </section>

      {episodes.map((server) => (
        <section key={server.serverName} className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">{server.serverName}</h2>
          <div className="max-h-72 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {server.serverData.map((ep) => (
                <a
                  key={ep.slug}
                  href={`/movies/${movie.slug}/watch?episode=${encodeURIComponent(ep.slug)}`}
                  className="min-w-14 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-center text-sm text-neutral-200 transition hover:border-rose-600 hover:text-white"
                >
                  {ep.name}
                </a>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="mt-10 space-y-3">
        <h2 className="text-base font-semibold text-neutral-100">Bình luận</h2>
        <div className="rounded-xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-500">
          Tính năng bình luận sẽ sớm khả dụng khi Backend hoàn thiện.
        </div>
      </section>
    </div>
  );
}
