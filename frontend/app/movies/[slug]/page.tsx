import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Clock, Lock, Play, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShareButton } from "@/components/common/ShareButton";
import { PROVIDER_LABELS } from "@/lib/providers/types";
import { getAggregatedMovieDetail } from "@/lib/server-api";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const agg = await getAggregatedMovieDetail(slug);
  const movie = agg.primary?.movie ?? agg.secondary?.movie;
  if (!movie) return { title: "Không tìm thấy phim" };
  return {
    title: movie.name,
    description: movie.content?.slice(0, 160) || undefined,
    openGraph: {
      title: movie.name,
      images: movie.posterUrl ? [movie.posterUrl] : undefined,
    },
  };
}

export default async function MovieDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const agg = await getAggregatedMovieDetail(slug, { maxAgeMs: 5 * 60 * 1000 });
  const { primary, secondary, secondarySlug } = agg;
  const movie = primary?.movie ?? secondary?.movie;
  if (!movie) notFound();

  // Nhóm tập theo nguồn — cả 2 nguồn song song
  const groups = [
    primary && primary.episodes.length > 0
      ? {
          key: "1",
          label: PROVIDER_LABELS["vsmov"],
          eslug: slug,
          episodes: primary.episodes,
        }
      : null,
    secondary &&
    secondary.episodes.length > 0 &&
    secondarySlug
      ? {
          key: "2",
          label: PROVIDER_LABELS["kkphim"],
          eslug: secondarySlug,
          episodes: secondary.episodes,
        }
      : null,
  ].filter((g): g is NonNullable<typeof g> => g !== null);

  const firstGroup = groups[0];
  const firstEpisode = firstGroup?.episodes[0]?.serverData[0];
  const watchHref = firstGroup && firstEpisode
    ? `/movies/${slug}/watch?src=${firstGroup.key}&eslug=${encodeURIComponent(firstGroup.eslug)}&episode=${encodeURIComponent(firstEpisode.slug)}`
    : `/movies/${slug}/watch`;

  const metaChips = [
    movie.quality,
    movie.lang,
    movie.year ? String(movie.year) : null,
    movie.episodeTotal ? `Tập ${movie.episodeCurrent ?? "?"}/${movie.episodeTotal}` : null,
    movie.time ? `${movie.time} phút` : null,
    groups.length > 1 ? "2 nguồn phát" : groups.length === 1 ? groups[0].label : null,
  ].filter(Boolean) as string[];

  return (
    <article className="pt-4 md:pt-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl ring-1 ring-border/60">
        <div className="absolute inset-0" aria-hidden>
          {movie.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={movie.posterUrl} alt="" className="h-full w-full object-cover opacity-15 blur-md" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        </div>

        <div className="relative flex flex-col gap-6 bg-background/40 p-5 sm:flex-row sm:p-8">
          <div className="w-36 shrink-0 self-center sm:w-44 sm:self-start">
            <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-border/60">
              {movie.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={movie.thumbUrl}
                  alt={`Poster phim ${movie.name}`}
                  className="aspect-[2/3] w-full object-cover"
                  fetchPriority="high"
                />
              ) : (
                <div className="aspect-[2/3] w-full bg-card" />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <header className="space-y-1.5">
              <h1 className="text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl lg:text-3xl">
                {movie.name}
              </h1>
              {movie.originName ? (
                <p className="text-sm text-muted-foreground">{movie.originName}</p>
              ) : null}
            </header>

            <ul className="flex flex-wrap gap-1.5" aria-label="Thông tin phim">
              {metaChips.map((chip) => (
                <li key={chip}>
                  <Badge variant="secondary" className="font-medium">
                    {chip}
                  </Badge>
                </li>
              ))}
            </ul>

            {movie.content ? (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {movie.content}
              </p>
            ) : null}

            <dl className="space-y-1.5 text-xs text-muted-foreground">
              {movie.director.length > 0 ? (
                <div className="flex gap-1.5">
                  <dt className="shrink-0 font-medium text-foreground/70">Đạo diễn:</dt>
                  <dd>{movie.director.join(", ")}</dd>
                </div>
              ) : null}
              {movie.actor.length > 0 ? (
                <div className="flex gap-1.5">
                  <dt className="shrink-0 font-medium text-foreground/70">Diễn viên:</dt>
                  <dd className="line-clamp-2">{movie.actor.slice(0, 8).join(", ")}</dd>
                </div>
              ) : null}
            </dl>

            {movie.category.length > 0 || movie.country.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {movie.category.map((c) => (
                  <Button key={`c-${c.slug}`} variant="secondary" size="xs" className="rounded-full" asChild>
                    <Link href={`/genres/${c.slug}`}>{c.name}</Link>
                  </Button>
                ))}
                {movie.country.map((c) => (
                  <Button key={`n-${c.slug}`} variant="secondary" size="xs" className="rounded-full" asChild>
                    <Link href={`/countries/${c.slug}`}>{c.name}</Link>
                  </Button>
                ))}
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button size="lg" className="rounded-full" asChild>
                <Link href={watchHref}>
                  <Play aria-hidden /> Xem phim
                </Link>
              </Button>
              <ShareButton title={movie.name} className="rounded-full" />
              <Button variant="outline" className="rounded-full" disabled aria-disabled
                title="Yêu cầu đăng nhập — tính năng sẽ mở sau khi Backend hoàn thiện"
              >
                <Lock aria-hidden className="opacity-50" />
                Yêu thích
              </Button>
              <Button variant="outline" className="rounded-full" disabled aria-disabled
                title="Yêu cầu đăng nhập — tính năng sẽ mở sau khi Backend hoàn thiện"
              >
                <Lock aria-hidden className="opacity-50" />
                Xem sau
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Watch party CTA */}
      <section
        aria-label="Xem cùng bạn bè"
        className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-card/60 p-5 sm:flex-row sm:items-center"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Users className="size-5 text-primary" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Xem cùng bạn bè</h2>
            <p className="text-sm text-muted-foreground">
              Tạo phòng xem chung, đồng bộ thời gian thực kèm chat và reaction.
            </p>
          </div>
        </div>
        <Button disabled aria-disabled title="Tính năng sẽ mở sau khi Backend hoàn thiện" className="shrink-0">
          <Lock aria-hidden /> Tạo phòng xem chung
        </Button>
      </section>

      {/* Episodes — gộp cả 2 nguồn */}
      {groups.length > 0 ? (
        <section aria-label="Danh sách tập phim" className="mt-10 space-y-6">
          <h2 className="text-lg font-semibold tracking-tight">Danh sách tập</h2>
          {groups.map((group) =>
            group.episodes.map((server) => (
              <div
                key={`${group.key}-${server.serverName}`}
                className={groups.length > 1 ? "space-y-3 rounded-xl border border-border bg-card/30 p-4" : "space-y-3"}
              >
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                  {groups.length > 1 ? (
                    <>
                      <Badge variant="outline" className="font-normal">
                        {group.label}
                      </Badge>
                      <Separator orientation="vertical" className="hidden h-4 sm:block" />
                    </>
                  ) : null}
                  {server.serverName}
                </h3>
                <ol className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 overflow-y-auto">
                  {server.serverData.map((ep) => (
                    <li key={`${group.key}-${ep.slug}`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-center font-normal"
                        asChild
                      >
                        <Link
                          href={`/movies/${slug}/watch?src=${group.key}&eslug=${encodeURIComponent(group.eslug)}&episode=${encodeURIComponent(ep.slug)}`}
                          aria-label={`Xem ${ep.name} (${group.label})`}
                        >
                          {ep.name}
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ol>
              </div>
            )),
          )}
        </section>
      ) : (
        <section aria-label="Danh sách tập phim" className="mt-10">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-5 text-sm text-muted-foreground">
            <Clock className="size-5 shrink-0" aria-hidden />
            Phim này hiện chưa có tập phát nào khả dụng.
          </div>
        </section>
      )}
    </article>
  );
}
