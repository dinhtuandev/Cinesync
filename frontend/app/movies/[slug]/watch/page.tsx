import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AmbientModeToggle } from "@/components/watch/AmbientModeToggle";
import { VideoPlayerFrame } from "@/components/watch/VideoPlayerFrame";
import { PROVIDER_LABELS, type ProviderKey } from "@/lib/providers/types";
import {
  findMovieOnSource,
  getMovieDetail,
  getMovieDetailFromSource,
} from "@/lib/server-api";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ episode?: string; src?: string; eslug?: string }>;
}

// Trang watch là dynamic (không ISR): link video/embed cần tương đối tươi.
// Metadata phim vẫn hưởng in-memory cache nhưng bị giới hạn 5 phút (maxAgeMs)
// để tránh render link phát đã hết hạn, trong khi trang chi tiết vẫn ISR 10 phút.

export default async function WatchPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { episode: episodeParam, src: srcParam, eslug: eslugParam } = await searchParams;

  // src=2 → phát từ Nguồn 2 bằng eslug (slug riêng của nguồn đó)
  const sourceKey: ProviderKey = srcParam === "2" ? "kkphim" : "vsmov";
  const sourceNumber = sourceKey === "kkphim" ? "2" : "1";

  let data: Awaited<ReturnType<typeof getMovieDetail>> = null;
  try {
    if (sourceKey === "kkphim") {
      data = await getMovieDetailFromSource("kkphim", eslugParam ?? "", { maxAgeMs: 5 * 60 * 1000 });
    } else {
      data =
        (await getMovieDetailFromSource("vsmov", eslugParam || slug, { maxAgeMs: 5 * 60 * 1000 })) ??
        (await getMovieDetail(slug, { maxAgeMs: 5 * 60 * 1000 }));
    }
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

  // Ưu tiên link_embed (phát được trong iframe). Chỉ khi KHÔNG có embed
  // mới thử m3u8 bằng <video> native — lỗi thì overlay đề xuất chuyển nguồn.
  const embedSource = activeEpisode.linkEmbed || movie.trailerUrl || "";
  const hlsOnly = !embedSource && Boolean(activeEpisode.linkM3u8);
  const playerSrc = hlsOnly ? activeEpisode.linkM3u8! : embedSource;

  const watchHref = (over: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams({
      ...(srcParam ? { src: sourceNumber } : {}),
      ...(eslugParam ? { eslug: eslugParam } : {}),
      ...over,
    });
    return `/movies/${movie.slug}/watch?${p.toString()}`;
  };
  const epHref = (epSlug: string) => watchHref({ episode: epSlug });

  const prevEpisode = episodeIndex > 0 ? activeServer.serverData[episodeIndex - 1] : null;
  const nextEpisode =
    episodeIndex >= 0 && episodeIndex < activeServer.serverData.length - 1
      ? activeServer.serverData[episodeIndex + 1]
      : null;

  // ─── Fallback chéo: tính link nguồn còn lại để đề xuất khi nguồn hiện tại lỗi ───
  let altSource: { href: string; label: string } | null = null;
  try {
    if (sourceKey === "vsmov" && movie.slug) {
      const counterpartSlug = await findMovieOnSource("kkphim", {
        name: movie.name,
        originName: movie.originName,
        year: movie.year,
      });
      if (counterpartSlug && counterpartSlug !== movie.slug) {
        altSource = {
          href: `/movies/${movie.slug}/watch?src=2&eslug=${encodeURIComponent(counterpartSlug)}`,
          label: PROVIDER_LABELS["kkphim"],
        };
      }
    } else if (sourceKey === "kkphim") {
      altSource = {
        href: `/movies/${movie.slug}/watch`,
        label: PROVIDER_LABELS["vsmov"],
      };
    }
  } catch {
    altSource = null;
  }

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
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {PROVIDER_LABELS[sourceKey]}
        </Badge>
        {altSource ? (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" asChild>
            <Link
              href={altSource.href}
              title={`Nguồn này không xem được? Chuyển sang ${altSource.label}`}
            >
              <Repeat aria-hidden /> Chuyển {altSource.label}
            </Link>
          </Button>
        ) : null}
      </nav>

      <VideoPlayerFrame
        src={playerSrc}
        title={`${movie.name} — ${activeEpisode.name}`}
        isHls={hlsOnly}
        altSource={altSource}
        toolbarLeft={<AmbientModeToggle posterUrl={movie.posterUrl || movie.thumbUrl} />}
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
            {activeServer.serverName} · {PROVIDER_LABELS[sourceKey]}
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
