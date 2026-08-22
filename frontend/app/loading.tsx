import { MovieCarouselSkeleton } from "@/components/common/MovieCarousel";

export default function HomeLoading() {
  return (
    <div className="space-y-10 pt-4 md:space-y-12 md:pt-6" aria-busy="true" aria-label="Đang tải trang chủ">
      <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-muted sm:aspect-[21/9] lg:aspect-[21/8]" />
      <MovieCarouselSkeleton />
      <MovieCarouselSkeleton />
    </div>
  );
}
