import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoPlayerFrame } from "@/components/watch/VideoPlayerFrame";
import { getMovieDetail } from "@/lib/server-api";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ episode?: string }>;
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
  const servers = episodes.length ? episodes : [{ serverName: "Server #1", serverData: [] }];

  const activeServer =
    servers.find((s) => s.serverData.some((e) => e.slug === episodeParam)) ?? servers[0];
  const activeEpisode =
    activeServer.serverData.find((e) => e.slug === episodeParam) ??
    activeServer.serverData[0] ??
    null;

  // Ưu tiên m3u8 (tương lai dùng player HLS riêng); hiện tại iframe chỉ phát được embed
  const hlsSource = activeEpisode?.linkM3u8 ?? null;
  const embedSource = !hlsSource ? (activeEpisode?.linkEmbed || movie.trailerUrl || "") : "";
  const isHls = Boolean(hlsSource);

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <Link href={`/movies/${movie.slug}`} className="hover:text-white">
          ← {movie.name}
        </Link>
        {activeEpisode ? (
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200">
            {activeEpisode.name}
          </span>
        ) : null}
      </div>

      <VideoPlayerFrame
        src={isHls ? (hlsSource as string) : embedSource}
        title={`${movie.name} — ${activeEpisode?.name ?? "Full"}`}
        isHls={isHls}
      />

      {activeServer.serverData.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-200">{activeServer.serverName}</h2>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-neutral-800 p-3">
            <div className="flex flex-wrap gap-2">
              {activeServer.serverData.map((ep) => {
                const isActive = ep.slug === activeEpisode?.slug;
                return (
                  <Link
                    key={ep.slug}
                    href={`/movies/${movie.slug}/watch?episode=${encodeURIComponent(ep.slug)}`}
                    scroll={false}
                    className={`min-w-14 rounded-lg px-3 py-2 text-center text-sm transition ${
                      isActive
                        ? "bg-rose-600 font-medium text-white"
                        : "border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-rose-600 hover:text-white"
                    }`}
                  >
                    {ep.name}
                  </Link>
                );
              })}
            </div>
          </div>
          {servers.length > 1 ? (
            <p className="text-xs text-neutral-500">
              Các server khác:{" "}
              {servers
                .filter((s) => s !== activeServer)
                .map((s) => s.serverName)
                .join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
