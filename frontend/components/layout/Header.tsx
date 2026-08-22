"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Clapperboard, Lock, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_ITEMS } from "./nav-items";

function BrandMark() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-1.5 text-lg font-bold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md"
      aria-label="CineSync — về trang chủ"
    >
      <Clapperboard className="size-5 text-primary" aria-hidden />
      <span className="text-foreground">
        Cine<span className="text-primary">Sync</span>
      </span>
    </Link>
  );
}

export function Header() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const kw = keyword.trim();
    if (kw.length < 2) return;
    router.push(`/search?keyword=${encodeURIComponent(kw)}`);
  }

  // Đóng sheet khi điều hướng xong
  useEffect(() => {
    setMobileOpen(false);
  }, [router]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:h-16 md:px-6">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 md:hidden" aria-label="Mở menu">
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle asChild>
                <div>
                  <BrandMark />
                </div>
              </SheetTitle>
            </SheetHeader>
            <nav aria-label="Điều hướng chính" className="mt-2 flex flex-col gap-1 px-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <form
              onSubmit={(e) => {
                submitSearch(e);
                setMobileOpen(false);
              }}
              className="mt-4 px-2"
            >
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm phim..."
                  minLength={2}
                  aria-label="Tìm kiếm phim"
                  className="pl-9"
                />
              </div>
            </form>
          </SheetContent>
        </Sheet>

        <BrandMark />

        {/* Desktop nav */}
        <nav aria-label="Điều hướng chính" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop search */}
        <form ref={searchRef} onSubmit={submitSearch} className="ml-auto hidden sm:block">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm phim..."
              minLength={2}
              aria-label="Tìm kiếm phim"
              className="w-52 pl-9 lg:w-64"
            />
          </div>
        </form>

        {/* Mobile search */}
        <Button variant="ghost" size="icon" className="ml-auto sm:hidden" asChild>
          <Link href="/search" aria-label="Tìm kiếm phim">
            <Search aria-hidden />
          </Link>
        </Button>

        <Button disabled aria-disabled title="Tính năng sẽ mở sau khi Backend hoàn thiện">
          <Lock aria-hidden /> Đăng nhập
        </Button>
      </div>
    </header>
  );
}
