import Link from "next/link";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <Film className="size-10 text-muted-foreground/50" aria-hidden />
      <p className="font-mono text-7xl font-bold tracking-tight text-muted-foreground/40">404</p>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Không tìm thấy trang hoặc phim</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Trang bạn tìm không tồn tại hoặc phim đã bị gỡ khỏi nguồn dữ liệu.
        </p>
      </div>
      <div className="flex gap-2.5">
        <Button asChild>
          <Link href="/">Về trang chủ</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/search">Tìm phim khác</Link>
        </Button>
      </div>
    </div>
  );
}
