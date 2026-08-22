"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Thể loại", href: "/genres" },
  { label: "Quốc gia", href: "/countries" },
  { label: "Năm", href: "/years" },
  { label: "Phim lẻ", href: "/movies?type=phim-le" },
  { label: "Phim bộ", href: "/movies?type=phim-bo" },
];

export function Header() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (keyword.trim().length < 2) return;
    router.push(`/search?keyword=${encodeURIComponent(keyword.trim())}`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="shrink-0 text-xl font-bold text-rose-500">
          CineSync
        </Link>
        <nav className="hidden gap-4 text-sm text-neutral-300 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <form onSubmit={submitSearch} className="ml-auto hidden sm:block">
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm phim..."
            minLength={2}
            className="w-56 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-sm outline-none placeholder:text-neutral-500 focus:border-rose-600"
          />
        </form>
        <button
          type="button"
          className="ml-auto shrink-0 rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 sm:ml-0"
        >
          Đăng nhập
        </button>
      </div>
    </header>
  );
}
