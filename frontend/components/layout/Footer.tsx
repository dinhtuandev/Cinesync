import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const FOOTER_SECTIONS = [
  {
    heading: "Khám phá",
    links: [
      { label: "Thể loại", href: "/genres" },
      { label: "Quốc gia", href: "/countries" },
      { label: "Phát hành theo năm", href: "/years" },
      { label: "Phim mới cập nhật", href: "/movies?type=phim-moi-cap-nhat" },
    ],
  },
  {
    heading: "Danh mục phim",
    links: [
      { label: "Phim lẻ", href: "/movies?type=phim-le" },
      { label: "Phim bộ", href: "/movies?type=phim-bo" },
      { label: "Đang chiếu", href: "/movies?type=dang-chieu" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3 lg:col-span-2 sm:max-w-xs">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-lg font-bold tracking-tight"
              aria-label="CineSync — về trang chủ"
            >
              <Clapperboard className="size-5 text-primary" aria-hidden />
              <span>
                Cine<span className="text-primary">Sync</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Nền tảng xem phim trực tuyến với phòng xem chung thời gian thực — cùng xem, cùng chat,
              cùng phản hồi với bạn bè.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.heading} aria-label={section.heading} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{section.heading}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Separator className="my-6" />

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} CineSync. Dự án đồ án sinh viên CNTT.
        </p>
      </div>
    </footer>
  );
}
