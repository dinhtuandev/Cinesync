"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Dices, ExternalLink, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MovieListItem } from "@/lib/types";

interface RandomMovieWheelProps {
  pool: MovieListItem[];
}

const SPIN_TURNS = 5;
const SPIN_DURATION_MS = 4600;

export function RandomMovieWheel({ pool }: RandomMovieWheelProps) {
  const items = useMemo(() => pool.slice(0, 12), [pool]);
  const step = 360 / items.length;

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<MovieListItem | null>(null);

  const spin = useCallback(() => {
    if (spinning || items.length === 0) return;
    setWinner(null);
    setSpinning(true);

    const winnerIndex = Math.floor(Math.random() * items.length);
    // Xoay wheel để winner dừng đúng vị trí kim (đỉnh): vòng quay lớn +
    // góc bù sao cho item winner về 0deg. Cộng dồn rotation để lần quay
    // sau vẫn quay tiếp cùng chiều.
    const targetMod = (360 - (winnerIndex * step)) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    setRotation(rotation + SPIN_TURNS * 360 + delta);
  }, [spinning, items.length, rotation, step]);

  const handleSpinEnd = useCallback(() => {
    if (!spinning) return;
    setSpinning(false);
    // Winner = item đang ở vị trí đỉnh sau khi xoay
    const mod = ((rotation % 360) + 360) % 360;
    const winnerIndex = Math.round((360 - mod) % 360 / step) % items.length;
    setWinner(items[winnerIndex] ?? null);
  }, [spinning, rotation, step, items]);

  if (items.length === 0) return null;

  const radius = 38; // % của container

  return (
    <div className="flex flex-col items-center gap-8 pt-6 lg:flex-row lg:items-start lg:justify-center lg:gap-14">
      {/* ─── Wheel ─── */}
      <div className="relative aspect-square w-full max-w-[380px] shrink-0">
        {/* Kim chỉ ở đỉnh */}
        <div
          aria-hidden
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1"
        >
          <div className="size-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-primary drop-shadow" />
        </div>

        {/* Vòng tròn ngoài */}
        <div className="absolute inset-0 rounded-full border-4 border-border bg-card/40 shadow-inner" />

        {/* Đĩa quay */}
        <div
          className="absolute inset-3"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.75, 0.12, 1)`
              : undefined,
          }}
          onTransitionEnd={handleSpinEnd}
          aria-live={winner ? "polite" : undefined}
        >
          {items.map((movie, i) => {
            const angle = i * step;
            const isWinner = winner?.slug === movie.slug && !spinning;
            return (
              <div
                key={movie.slug}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius * 4}px)`,
                }}
              >
                <div
                  className={`size-16 overflow-hidden rounded-full ring-2 transition-all duration-300 sm:size-20 ${
                    isWinner
                      ? "scale-110 ring-primary shadow-[0_0_24px] shadow-primary/60"
                      : "ring-border/60"
                  }`}
                >
                  {movie.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={movie.thumbUrl}
                      alt={movie.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Nút quay trung tâm */}
        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          aria-label="Quay chọn phim ngẫu nhiên"
          className="absolute left-1/2 top-1/2 z-10 flex size-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full border-4 border-background bg-primary text-primary-foreground shadow-xl outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-wait disabled:opacity-80"
        >
          <Dices aria-hidden className="size-6" />
          <span className="text-xs font-bold">{spinning ? "..." : "QUAY"}</span>
        </button>
      </div>

      {/* ─── Kết quả / Preview ─── */}
      <div className="w-full max-w-sm space-y-4 text-center lg:pt-6 lg:text-left">
        {winner ? (
          <>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Phù hợp với bạn
              </p>
              <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground">
                {winner.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {[winner.originName, winner.year || null].filter(Boolean).join(" · ")}
              </p>
            </div>

            <ul className="flex flex-wrap justify-center gap-1.5 lg:justify-start" aria-label="Thông tin phim">
              <li>
                <Badge variant="secondary">{winner.quality}</Badge>
              </li>
              <li>
                <Badge variant="secondary">{winner.lang}</Badge>
              </li>
              {winner.episodeTotal ? (
                <li>
                  <Badge variant="secondary">
                    Tập {winner.episodeCurrent ?? "?"}/{winner.episodeTotal}
                  </Badge>
                </li>
              ) : null}
            </ul>

            <div className="flex flex-wrap justify-center gap-2.5 lg:justify-start">
              <Button size="lg" className="rounded-full" asChild>
                <Link href={`/movies/${winner.slug}/watch`}>
                  <Play aria-hidden /> Xem ngay
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full" asChild>
                <Link href={`/movies/${winner.slug}`}>
                  <ExternalLink aria-hidden /> Chi tiết
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2 py-8 lg:py-16">
            <p className="text-base font-semibold text-foreground">
              {spinning ? "Đang quay..." : "Không biết xem gì?"}
            </p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground lg:mx-0">
              {spinning
                ? "Vòng quay đang chậm dần..."
                : "Bấm QUAY để để CineSync chọn giúp bạn một phim từ danh sách mới nhất."}
            </p>
          </div>
        )}

        {winner && !spinning ? (
          <Button variant="ghost" size="sm" onClick={spin} className="mx-auto lg:mx-0">
            <RotateCcw aria-hidden /> Quay lại lần nữa
          </Button>
        ) : null}
      </div>
    </div>
  );
}
