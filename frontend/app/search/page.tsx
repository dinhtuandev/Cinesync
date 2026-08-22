"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { SearchX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/States";
import { MoviePosterCard } from "@/components/common/MoviePosterCard";
import type { MovieListItem } from "@/lib/types";

type Status = "idle" | "loading" | "error" | "done";

function SearchResults() {
  const searchParams = useSearchParams();
  const initialKeyword = searchParams.get("keyword") ?? "";

  const [keyword, setKeyword] = useState(initialKeyword);
  const [results, setResults] = useState<MovieListItem[]>([]);
  const [status, setStatus] = useState<Status>(initialKeyword ? "loading" : "idle");
  const requestId = useRef(0);

  // Sync khi URL đổi (VD: submit search từ Header)
  useEffect(() => {
    setKeyword(searchParams.get("keyword") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const kw = keyword.trim();
    if (kw.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const id = ++requestId.current;
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?keyword=${encodeURIComponent(kw)}`);
        const body = await res.json();
        if (id !== requestId.current) return; // stale response
        if (!res.ok || !body.success) throw new Error(body.message);
        setResults(body.data.items as MovieListItem[]);
        setStatus("done");
      } catch {
        if (id !== requestId.current) return;
        setStatus("error");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [keyword]);

  const trimmed = keyword.trim();
  const canSearch = trimmed.length >= 2;

  return (
    <div className="space-y-6 pt-8">
      <header className="mx-auto max-w-xl space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Tìm kiếm phim
        </h1>
        <p className="text-sm text-muted-foreground">
          Nhập tối thiểu 2 ký tự để tìm theo tên phim tiếng Việt hoặc tên gốc
        </p>
      </header>

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mx-auto max-w-xl"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Ví dụ: Conan, Money Heist..."
            aria-label="Từ khóa tìm kiếm"
            aria-describedby="search-hint"
            className="h-11 rounded-full pl-10 text-base"
            autoFocus
          />
        </div>
        <p id="search-hint" className="mt-2 text-center text-xs text-muted-foreground">
          {canSearch ? `Đang tìm "${trimmed}"...` : "Từ khóa cần tối thiểu 2 ký tự"}
        </p>
      </form>

      {status === "loading" ? (
        <ul
          aria-busy="true"
          aria-label="Đang tải kết quả"
          className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <li key={i} className="space-y-2.5">
              <Skeleton className="aspect-[2/3] rounded-xl" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </li>
          ))}
        </ul>
      ) : status === "error" ? (
        <ErrorState
          title="Không tải được kết quả tìm kiếm"
          description="Nguồn dữ liệu đang gặp sự cố. Vui lòng thử lại sau."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const id = ++requestId.current;
                setStatus("loading");
                fetch(`/api/search?keyword=${encodeURIComponent(trimmed)}`)
                  .then((r) => r.json())
                  .then((body) => {
                    if (id !== requestId.current) return;
                    setResults(body.success ? (body.data.items as MovieListItem[]) : []);
                    setStatus("done");
                  })
                  .catch(() => {
                    if (id !== requestId.current) return;
                    setStatus("error");
                  });
              }}
            >
              Thử lại
            </Button>
          }
        />
      ) : status === "done" && results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`Không tìm thấy phim phù hợp với "${trimmed}"`}
          description="Kiểm tra lại chính tả hoặc thử từ khóa khác ngắn gọn hơn."
        />
      ) : results.length > 0 ? (
        <section aria-label={`Kết quả cho ${trimmed}`}>
          <p className="mb-4 text-sm text-muted-foreground">
            Tìm thấy {results.length} kết quả cho &quot;{trimmed}&quot;
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {results.map((movie, i) => (
              <li key={movie.slug}>
                <MoviePosterCard movie={movie} priority={i < 6} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pt-8">
          <Skeleton className="mx-auto h-8 w-56" />
          <Skeleton className="mx-auto h-11 w-full max-w-xl rounded-full" />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
