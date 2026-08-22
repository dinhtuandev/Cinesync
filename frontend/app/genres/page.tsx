import { ChipList } from "@/components/common/Browse";
import { ErrorState } from "@/components/common/States";
import { getGenres } from "@/lib/server-api";

export const revalidate = 3600;

export const metadata = { title: "Thể loại phim" };

export default async function GenresPage() {
  let genres: { name: string; slug: string }[] = [];
  let failed = false;
  try {
    genres = await getGenres();
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <ErrorState
        className="mt-8"
        title="Không tải được danh sách thể loại"
        description="Nguồn dữ liệu đang gặp sự cố. Vui lòng thử lại sau."
      />
    );
  }

  return (
    <ChipList
      heading="Thể loại phim"
      description={`${genres.length} thể loại để bạn khám phá`}
      items={genres}
      basePath="/genres"
    />
  );
}
