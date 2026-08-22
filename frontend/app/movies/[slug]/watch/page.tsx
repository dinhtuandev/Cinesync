import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VideoPlayerFrame } from "@/components/watch/VideoPlayerFrame";
import { getMovieDetail } from "@/lib/server-api";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ episode?: string; server?: string }>;
}

// Trang watch là dynamic (không ISR): link video/embed cần tương đối tươi.
// Metadata phim vẫn hưởng in-memory cache nhưng bị giới hạn 5 phút (maxAgeMs)
// để tránh render link phát đã hết hạn, trong khi trang chi tiết vẫn ISR 10 phút.

export default async function WatchPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { episode: episodeParam } = await searchParams;

  let data: Awaited<ReturnType<typeof getMovieDetail>> = null;
  try {
    data = await getMovieDetail(slug, { maxAgeMs: 5 * 60 * 1000 });
  } catch {
    data = null;
  }
  if (!data) notFound();

  const { movie, episodes } = data;
  const servers = episodes.length ? episodes : [];
  const activeServer =
    servers.find((s) => s.serverData.some((e) => e.slug === episodeParam)) ?? servers[0];
  if (!activeServer) notFound();

  const episodeIndex = activeServer.serverData.findIndex(
    (e) => e.slug === (episodeParam ?? activeServer.serverData[0]?.slug),
  );
  const activeEpisode =
    activeServer.serverData[episodeIndex] ?? activeServer.serverData[0] ?? null;
  if (!activeEpisode) notFound();

  // Ưu tiên m3u8 (tương lai dùng player HLS riêng); hiện tại iframe chỉ phát được embed
  const hlsSource = activeEpisode.linkM3u8;
  const embedSource = hlsSource ? "" : activeEpisode.linkEmbed || movie.trailerUrl || "";
  const isHls = Boolean(hlsSource);

  const epHref = (epSlug: string) =>
    `/movies/${movie.slug}/watch?episode=${encodeURIComponent(epSlug)}`;
  const prevEpisode =
    episodeIndex > 0 ? activeServer.serverData[episodeIndex - 1] : null;
  const nextEpisode =
    episodeIndex >= 0 && episodeIndex < activeServer.serverData.length - 1
      ? activeServer.serverData[episodeIndex + 1]
      : null;

  return (
    <div className="space-y-4 pt-4 md:pt-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" className="-ml-2 h-7" asChild>
          <Link href={`/movies/${movie.slug}`}>
            <ArrowLeft aria-hidden /> {movie.name}
          </Link>
        </Button>
        {activeServer.serverData.length > 1 ? (
          <Badge variant="secondary">{activeEpisode.name}</Badge>
        ) : null}
      </nav>

      <VideoPlayerFrame
        src={isHls ? hlsSource! : embedSource}
        title={`${movie.name} — ${activeEpisode.name}`}
        isHls={isHls}
      />

      {/* Điều khiển tập */}
      {activeServer.serverData.length > 1 ? (
        <div className="flex items-center justify-between gap-2">
          {prevEpisode ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={epHref(prevEpisode.slug)} rel="prev">
                <ChevronLeft aria-hidden /> Tập trước
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Đang xem: <span className="font-medium text-foreground">{activeEpisode.name}</span> ·{" "}
            {activeServer.serverName}
          </p>
          {nextEpisode ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={epHref(nextEpisode.slug)} rel="next">
                Tập sau <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </div>
      ) : null}

      {/* Danh sách tập */}
      {activeServer.serverData.length > 1 ? (
        <section aria-label="Danh sách tập" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {activeServer.serverName}
          </h2>
          <ol className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 overflow-y-auto rounded-xl border border-border bg-card/50 p-3">
            {activeServer.serverData.map((ep) => {
              const isActive = ep.slug === activeEpisode?.slug;
              return (
                <li key={ep.slug}>
                  <Button
                    variant={isActive ? "default" : "secondary"}
                    size="sm"
                    className="w-full justify-center font-normal"
                    aria-current={isActive ? "true" : undefined}
                    asChild
                  >
                    <Link href={epHref(ep.slug)} scroll={false}>
                      {ep.name}
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ol>

          {servers.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              Server khác:{" "}
              {servers
                .filter((s) => s !== activeServer)
                .map((s) => s.serverName)
                .join(" · ")}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
