"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Player wrapper cho nguồn embed của MDP.
 *
 * GIỚI HẠN đã biết: iframe third-party — CineSync KHÔNG kiểm soát được
 * buffering, bitrate, adaptive quality hay internals của player bên trong.
 * Chỉ kiểm soát được vòng đời container (retry, timeout, fullscreen).
 *
 * Che giấu nguồn (source masking):
 * - `referrerPolicy="no-referrer"` — không gửi Referer, provider không thấy
 *   domain CineSync trong log.
 * - Overlay đè lên vùng logo/title/watermark quen thuộc của player nguồn
 *   (top bar + góc dưới phải), `pointer-events-none` để không chặn điều
 *   khiển của player bên dưới.
 * - GIỚI HẠN: người dùng rành kỹ thuật vẫn thấy URL iframe trong DevTools.
 *   Che giấu tuyệt đối chỉ đạt được khi tự host video qua HLS (Backend).
 *
 * Khi Backend cung cấp linkM3u8 thật, nhánh `isHls` là chỗ cắm HLS.js
 * để kiểm soát đầy đủ playback. KHÔNG nhánh này thành HLS.js cho tới khi
 * có nguồn HLS thực tế.
 */
interface VideoPlayerFrameProps {
  src: string;
  title: string;
  /** true nếu nguồn là link m3u8 (chưa phát trực tiếp được trong iframe) */
  isHls?: boolean;
  /** Che logo/title/watermark của nguồn embed (mặc định bật) */
  maskSourceBranding?: boolean;
}

const LOAD_TIMEOUT_MS = 15_000;

export function VideoPlayerFrame({
  src,
  title,
  isHls = false,
  maskSourceBranding = true,
}: VideoPlayerFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
    if (!src || isHls) return;
    const timer = setTimeout(() => setStatus((s) => (s === "loading" ? "error" : s)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [src, reloadKey, isHls]);

  const handleLoad = useCallback(() => setStatus("ready"), []);

  const handleRetry = useCallback(() => {
    setReloadKey((k) => k + 1);
    setStatus("loading");
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
        const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
        await orientation?.lock?.("landscape").catch(() => {});
      }
    } catch {
      /* trình duyệt không hỗ trợ — bỏ qua */
    }
  }, []);

  return (
    <div ref={containerRef} className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {src && !isHls ? (
        <iframe
          key={reloadKey}
          src={src}
          title={title}
          onLoad={handleLoad}
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          className="h-full w-full border-0"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center space-y-2 px-4 text-center">
          <p className="text-sm text-neutral-400">
            {isHls
              ? "Nguồn HLS sẽ được phát bằng Player riêng khi Backend hoàn thiện"
              : "Nguồn phát này chưa khả dụng"}
          </p>
        </div>
      )}

      {status === "loading" && !isHls ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-rose-600" />
            <p className="text-xs text-neutral-400">Đang tải nguồn phát...</p>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-black/95 px-4 text-center">
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">Không tải được nguồn phát</p>
            <p className="text-xs text-neutral-400">
              Kết nối có thể bị gián đoạn khi xoay màn hình hoặc đổi mạng
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-neutral-600 px-6 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      ) : null}

      {src && !isHls && maskSourceBranding ? (
        <>
          {/* Thanh trên: che title bar/logo của player nguồn, thay bằng brand CineSync */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex h-11 items-center bg-gradient-to-b from-black via-black/75 to-transparent px-3"
          >
            <span className="text-sm font-bold tracking-wide text-white">
              Cine<span className="text-rose-500">Sync</span>
            </span>
          </div>
          {/* Góc dưới phải: vị trí watermark phổ biến của player nguồn */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-2 right-2 z-[5] h-7 w-28 rounded-md border border-white/5 bg-black/55 backdrop-blur-sm"
          />
        </>
      ) : null}

      {src && !isHls ? (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Toàn màn hình"
          className="absolute right-2 top-2 z-10 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white opacity-70 backdrop-blur transition hover:opacity-100 md:hidden"
        >
          ⛶
        </button>
      ) : null}
    </div>
  );
}
