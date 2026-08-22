import Link from "next/link";
import { ChevronLeft, ChevronRight, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./States";

export function SectionHeader({
  title,
  moreHref,
}: {
  title: string;
  moreHref?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
      {moreHref ? (
        <Link
          href={moreHref}
          className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          Xem tất cả
        </Link>
      ) : null}
    </div>
  );
}

export function MovieGrid({
  title,
  subtitle,
  children,
  emptyTitle = "Không tìm thấy phim nào",
  emptyDescription = "Thử duyệt mục khác hoặc quay lại trang chủ.",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const items = Array.isArray(children) ? children.flat() : [children];
  const hasItems = items.filter(Boolean).length > 0;

  if (!hasItems) {
    return (
      <EmptyState
        icon={Clapperboard}
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Về trang chủ</Link>
          </Button>
        }
        className="mt-6"
      />
    );
  }

  return (
    <section aria-label={title} className="pt-8">
      <header className="mb-4 space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items}
      </ul>
    </section>
  );
}

export function ChipList({
  heading,
  description,
  items,
  basePath,
}: {
  heading: string;
  description?: string;
  items: { name: string; slug: string }[];
  basePath: string;
}) {
  return (
    <div className="space-y-5 pt-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {heading}
        </h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.slug}>
            <Button variant="secondary" size="sm" className="rounded-full" asChild>
              <Link href={`${basePath}/${item.slug}`}>{item.name}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;

  const windowSize = 2;
  const pages: number[] = [];
  for (let p = Math.max(1, page - windowSize); p <= Math.min(totalPages, page + windowSize); p++) {
    pages.push(p);
  }

  const href = (p: number) =>
    basePath.includes("?") ? `${basePath}&page=${p}` : `${basePath}?page=${p}`;

  return (
    <nav aria-label="Phân trang" className="flex items-center justify-center gap-1.5 pt-10">
      {page > 1 ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={href(page - 1)} aria-label="Trang trước">
            <ChevronLeft aria-hidden /> Trước
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled aria-disabled>
          <ChevronLeft aria-hidden /> Trước
        </Button>
      )}

      {pages[0] > 1 ? (
        <>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={href(1)}>1</Link>
          </Button>
          {pages[0] > 2 ? (
            <span className="px-1 text-sm text-muted-foreground" aria-hidden>
              …
            </span>
          ) : null}
        </>
      ) : null}

      {pages.map((p) => (
        <Button
          key={p}
          variant={p === page ? "default" : "ghost"}
          size="icon-sm"
          asChild
          aria-current={p === page ? "page" : undefined}
        >
          <Link href={href(p)}>{p}</Link>
        </Button>
      ))}

      {pages[pages.length - 1] < totalPages ? (
        <>
          {pages[pages.length - 1] < totalPages - 1 ? (
            <span className="px-1 text-sm text-muted-foreground" aria-hidden>
              …
            </span>
          ) : null}
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={href(totalPages)}>{totalPages}</Link>
          </Button>
        </>
      ) : null}

      {page < totalPages ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={href(page + 1)} aria-label="Trang sau">
            Sau <ChevronRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled aria-disabled>
          Sau <ChevronRight aria-hidden />
        </Button>
      )}
    </nav>
  );
}
