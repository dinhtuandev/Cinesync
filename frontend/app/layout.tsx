import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "CineSync — Xem phim cùng bạn bè",
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
          <Header />
          <main className="mx-auto max-w-7xl px-4 pb-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
