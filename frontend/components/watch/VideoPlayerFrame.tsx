"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { PictureInPicture2, PictureInPicture, Repeat } from "lucide-react";

/**
 * Player wrapper cho nguồn embed của MDP.
 *
 * GIỚI HẠN đã biết: iframe third-party — CineSync KHÔNG kiểm soát được
 * buffering, bitrate, adaptive quality, watermark/logo của player nguồn
 * hay internals bên trong. Chỉ kiểm soát được vòng đời container
 * (retry, timeout, fullscreen, PiP). `referrerPolicy="no-referrer"` giữ lại
 * để provider không thấy domain CineSync trong referer log.
 *
 * Picture-in-Picture dùng Document PiP API (Chromium desktop): cả player
 * được render vào cửa sổ luôn-nổi, xem tiếp khi rời tab. Mobile không hỗ
 * trợ API này — nút sẽ ẩn đi.
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
  /** Nguồn dự phòng: hiển thị nút chuyển nguồn trong overlay lỗi */
  altSource?: { href: string; label: string } | null;
  /** Nút phụ hiển thị bên trái thanh công cụ dưới player (VD: Ambient Mode) */
  toolbarLeft?: React.ReactNode;
}

const LOAD_TIMEOUT_MS = 15_000;

interface DocPiPApi {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
  window: Window | null;
}

export function VideoPlayerFrame({
  src,
  title,
  isHls = false,
  altSource = null,
  toolbarLeft,
}: VideoPlayerFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipSupported, setPipSupported] = useState(false);

  useEffect(() => {
    setStatus("loading");
    if (!src) return;
    // HLS native: chờ canplay; iframe: chờ onLoad. Treo quá hạn → error
    // để UI đề xuất retry hoặc chuyển nguồn dự phòng.
    const timer = setTimeout(() => setStatus((s) => (s === "loading" ? "error" : s)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [src, reloadKey]);

  // Feature detect sau mount để tránh hydration mismatch
  useEffect(() => {
    setPipSupported(typeof window !== "undefined" && "documentPictureInPicture" in window);
  }, []);

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

  // ─── Document Picture-in-Picture ───
  const enterPip = useCallback(async () => {
    const api = (window as unknown as { documentPictureInPicture?: DocPiPApi }).documentPictureInPicture;
    if (!api) return;
    try {
      const win = await api.requestWindow({ width: 640, height: 360 });
      // Copy stylesheets để UI trong cửa sổ PiP giữ đúng theme
      [...document.styleSheets].forEach((sheet) => {
        try {
          const css = [...sheet.cssRules].map((r) => r.cssText).join("");
          const style = win.document.createElement("style");
          style.textContent = css;
          win.document.head.appendChild(style);
        } catch {
          /* CORS stylesheet — bỏ qua */
        }
      });
      win.document.title = `${title} — CineSync`;
      win.addEventListener("pagehide", () => setPipWindow(null));
      setPipWindow(win);
    } catch {
      /* user hủy hoặc lỗi — bỏ qua */
    }
  }, [title]);

  const exitPip = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
  }, [pipWindow]);

  /** Nội dung player — render ở trang chính HOẶC cửa sổ PiP */
  const playerContent = (
    <div className="relative h-full w-full overflow-hidden bg-black">
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
      ) : src && isHls ? (
        // Thử phát HLS trực tiếp bằng <video> (Safari/iOS hỗ trợ gốc).
        // Chrome desktop không decode m3u8 → onError → overlay lỗi → đề xuất
        // chuyển nguồn. Khi Backend sẵn sàng sẽ thay bằng HLS.js.
        <video
          key={`v-${reloadKey}`}
          controls
          autoPlay
          playsInline
          onCanPlay={handleLoad}
          onError={() => setStatus("error")}
          className="h-full w-full border-0 bg-black"
        >
          <source src={src} type="application/x-mpegURL" />
        </video>
      ) : (
        <div className="flex h-full flex-col items-center justify-center space-y-2 px-4 text-center">
          <p className="text-sm text-neutral-400">Nguồn phát này chưa khả dụng</p>
        </div>
      )}

      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3">
            <div className="size-10 animate-spin rounded-full border-2 border-neutral-700 border-t-primary" />
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
          <div className="flex flex-wrap items-center justify-center gap-3">
            {altSource ? (
              <Link
                href={altSource.href}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/80"
              >
                <Repeat aria-hidden className="size-4" />
                Chuyển sang {altSource.label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary/80"
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

      {src ? (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Toàn màn hình"
          title="Toàn màn hình"
          className="absolute right-2 top-2 z-10 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white opacity-70 backdrop-blur transition hover:opacity-100 md:hidden"
        >
          ⛶
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Khi đang PiP: khung chính hiển thị trạng thái */}
      <div ref={containerRef} className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-border/60">
        {pipWindow ? (
          createPortal(playerContent, pipWindow.document.body)
        ) : (
          playerContent
        )}

        {pipWindow ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 text-center">
            <PictureInPicture2 className="size-8 text-muted-foreground" aria-hidden />
            <p className="max-w-xs text-sm text-muted-foreground">
              Player đang phát trong cửa sổ mini — bạn có thể chuyển sang tab khác.
            </p>
            <button
              type="button"
              onClick={exitPip}
              className="rounded-full border border-border px-5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              Thu về trang chính
            </button>
          </div>
        ) : null}
      </div>

      {/* Thanh công cụ phụ dưới player */}
      {src ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">{toolbarLeft}</div>
          {pipSupported ? (
            <ButtonLike onClick={() => (pipWindow ? exitPip() : enterPip())}>
              <PictureInPicture aria-hidden className="size-4" />
              {pipWindow ? "Đóng mini player" : "Xem ngoài tab (mini)"}
            </ButtonLike>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ButtonLike({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[0.8rem] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}
