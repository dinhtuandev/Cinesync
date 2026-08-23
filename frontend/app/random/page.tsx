import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/States";
import { RandomMovieWheel } from "@/components/random/RandomMovieWheel";
import { getMovieList } from "@/lib/server-api";

export const metadata = { title: "Quay phim ngẫu nhiên" };

export const revalidate = 900;

export default async function RandomPage() {
  let pool: Awaited<ReturnType<typeof getMovieList>>["items"] = [];
  let failed = false;
  try {
    const [latest, single] = await Promise.all([
      getMovieList("phim-moi-cap-nhat", 1),
      getMovieList("phim-le", 1),
    ]);
    // Trộn 2 danh sách lấy đa dạng, loại slug trùng phòng hờ
    const seen = new Set<string>();
    pool = [...latest.items, ...single.items].filter((m) => {
      if (seen.has(m.slug)) return false;
      seen.add(m.slug);
      return true;
    });
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <ErrorState
        className="mt-8"
        title="Không tải được danh sách phim"
        description="Nguồn dữ liệu đang gặp sự cố. Vui lòng thử lại sau."
        action={
          <Button variant="outline" size="sm" asChild>
            <a href="/random">Thử lại</a>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-2 pt-6">
      <header className="mx-auto max-w-md space-y-1.5 text-center">
        <h1 className="flex items-center justify-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          <Dices className="size-5 text-primary" aria-hidden />
          Không biết xem gì?
        </h1>
        <p className="text-sm text-muted-foreground">
          Quay vòng để CineSync chọn giúp bạn một phim từ những tựa mới nhất.
        </p>
      </header>

      <RandomMovieWheel pool={pool} />
    </div>
  );
}
