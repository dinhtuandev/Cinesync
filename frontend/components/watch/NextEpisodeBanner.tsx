"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NextEpisodeBannerProps {
  nextHref: string;
  nextName: string;
  /** Thời lượng ước tính của tập (giây) — lấy từ metadata phim */
  durationSeconds: number;
}

const POLL_INTERVAL_MS = 10_000;

/**
 * Thông báo "xem hết tập" → gợi ý chuyển tập kế tiếp.
 *
 * GIỚI HẠN: iframe third-party không cho biết video kết thúc lúc nào,
 * nên thời điểm "hết tập" được ước lượng từ thời lượng metadata + thời
 * gian user ở lại trang (chỉ đếm khi tab đang hiển thị). Banner chỉ là
 * đề xuất — user có thể bỏ qua.
 */
export function NextEpisodeBanner({ nextHref, nextName, durationSeconds }: NextEpisodeBannerProps) {
  const [show, setShow] = useState(false);
  const elapsedVisibleMs = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        elapsedVisibleMs.current += POLL_INTERVAL_MS;
      }
      if (elapsedVisibleMs.current >= durationSeconds * 1000) {
        setShow(true);
        clearInterval(id);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [durationSeconds]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-80 translate-y-0 space-y-3 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur transition-all duration-300 sm:w-88"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <SkipForward className="size-4 text-primary" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Hết tập rồi?</p>
            <p className="text-xs text-muted-foreground">Chuyển sang {nextName}?</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShow(false)}
          aria-label="Đóng gợi ý chuyển tập"
          className="rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" asChild>
          <Link href={nextHref}>
            <SkipForward aria-hidden /> Xem tập sau
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShow(false)}>
          Để sau
        </Button>
      </div>
    </div>
  );
}
