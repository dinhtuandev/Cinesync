"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MoviePosterCard } from "@/components/common/MoviePosterCard";
import type { MovieListItem } from "@/lib/types";

function SearchResults() {
  const searchParams = useSearchParams();
  const keyword = searchParams.get("keyword") ?? "";
  const [results, setResults] = useState<MovieListItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (keyword.trim().length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?keyword=${encodeURIComponent(keyword.trim())}`);
        const body = await res.json();
        if (!res.ok || !body.success) throw new Error(body.message);
        setResults(body.data.items as MovieListItem[]);
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [keyword]);

  return (
    <div className="space-y-4 pt-6">
      <h1 className="text-lg font-semibold text-neutral-100">
        {keyword ? `Kết quả cho "${keyword}"` : "Tìm kiếm phim"}
      </h1>
      {keyword && keyword.trim().length < 2 ? (
        <p className="text-sm text-neutral-400">Từ khóa tìm kiếm phải có tối thiểu 2 ký tự</p>
      ) : status === "loading" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="aspect-[2/3] rounded-lg bg-neutral-800" />
              <div className="h-3 w-3/4 rounded bg-neutral-800" />
            </div>
          ))}
        </div>
      ) : status === "error" ? (
        <p className="text-sm text-red-400">
          Không thể tải dữ liệu phim lúc này, vui lòng thử lại sau
        </p>
      ) : results.length === 0 && keyword ? (
        <p className="text-sm text-neutral-400">
          Không tìm thấy phim phù hợp với &quot;{keyword}&quot;
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {results.map((movie) => (
            <MoviePosterCard key={movie.slug} movie={movie} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
