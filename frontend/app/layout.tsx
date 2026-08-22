import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CineSync — Xem phim cùng bạn bè",
    template: "%s — CineSync",
  },
  description:
    "Xem phim online miễn phí, tạo phòng xem chung real-time cùng bạn bè, đánh giá và nhận gợi ý phim cá nhân hóa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            Bỏ qua tới nội dung chính
          </a>
          <Header />
          <main id="main-content" className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-4 pb-16 md:px-6">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
