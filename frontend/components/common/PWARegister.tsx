"use client";

import { useEffect } from "react";

/** Đăng ký service worker cho PWA (cài làm shortcut app trên mobile). */
export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* đăng ký lỗi — app vẫn chạy bình thường */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
