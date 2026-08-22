"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/15">
        <TriangleAlert className="size-6 text-destructive" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Đã xảy ra lỗi</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Hệ thống gặp sự cố không mong muốn. Bạn có thể thử tải lại trang hoặc quay lại sau.
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground/70">Mã lỗi: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex gap-2.5">
        <Button onClick={reset}>
          <RotateCcw aria-hidden /> Thử lại
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    </div>
  );
}
