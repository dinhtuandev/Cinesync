"use client";

import { useCallback, useEffect, useState } from "react";
import { Clapperboard } from "lucide-react";

const STORAGE_KEY = "cinesync-ambient-mode";

/**
 * Nút bật/tắt Ambient Mode (chế độ rạp chiếu phim).
 * - Poster phim loang màu mờ phía sau player (glow)
 * - Header/footer + phần nền trang tự tối đi, tập trung ánh sáng vào player
 * - Lựa chọn lưu localStorage, mặc định tắt
 */
export function AmbientModeToggle({ posterUrl }: { posterUrl?: string | null }) {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Đọc trạng thái đã lưu
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* private mode — bỏ qua */
    }
    setLoaded(true);
  }, []);

  // Đồng bộ class lên <html> + persist
  useEffect(() => {
    if (!loaded) return;
    document.documentElement.classList.toggle("ambient-on", enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      /* bỏ qua */
    }
    return () => document.documentElement.classList.remove("ambient-on");
  }, [enabled, loaded]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  return (
    <>
      {/* Glow loang màu từ poster — nằm sau player */}
      {posterUrl ? (
        <div
          aria-hidden
          className={`pointer-events-none absolute -inset-x-8 -top-10 bottom-0 -z-10 overflow-hidden rounded-[2rem] transition-opacity duration-700 ${
            enabled ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterUrl}
            alt=""
            className="h-full w-full scale-110 object-cover blur-3xl saturate-150 brightness-[0.4]"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        title="Chế độ rạp chiếu phim: tối nền trang, loang màu hậu cảnh"
        className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[0.8rem] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${
          enabled
            ? "border-primary/60 bg-primary/15 text-primary"
            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Clapperboard aria-hidden className="size-4" />
        Rạp phim
      </button>
    </>
  );
}
