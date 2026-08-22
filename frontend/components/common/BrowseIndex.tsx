import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "./States";

interface IndexItem {
  name: string;
  slug: string;
}

/**
 * Trang chỉ mục duyệt phim (Thể loại / Quốc gia / Năm).
 * - variant="card": thẻ lớn có mũi tên (thể loại, quốc gia)
 * - variant="tile": ô vuông nhỏ gọn (năm phát hành, sắp mới nhất trước)
 */
export function BrowseIndex({
  heading,
  description,
  items,
  basePath,
  variant = "card",
}: {
  heading: string;
  description?: string;
  items: IndexItem[];
  basePath: string;
  variant?: "card" | "tile";
}) {
  const sorted =
    variant === "tile"
      ? [...items].sort((a, b) => Number(b.slug) - Number(a.slug))
      : items;

  return (
    <div className="space-y-6 pt-8">
      <header className="space-y-1.5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {heading}
          </h1>
          {sorted.length > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {sorted.length}
            </span>
          ) : null}
        </div>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>

      {sorted.length === 0 ? (
        <EmptyState
          icon={ChevronRight}
          title="Danh sách đang trống"
          description="Nguồn dữ liệu chưa trả về mục nào. Vui lòng thử lại sau."
          className="border-border"
        />
      ) : variant === "tile" ? (
        <ul
          className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]"
          aria-label={heading}
        >
          {sorted.map((item) => (
            <li key={item.slug}>
              <Link
                href={`${basePath}/${item.slug}`}
                className="flex h-11 items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors outline-none hover:border-primary/60 hover:bg-primary/10 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
          aria-label={heading}
        >
          {sorted.map((item) => (
            <li key={item.slug}>
              <Link
                href={`${basePath}/${item.slug}`}
                className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-foreground transition-all outline-none hover:border-primary/60 hover:bg-primary/5 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="truncate">{item.name}</span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
