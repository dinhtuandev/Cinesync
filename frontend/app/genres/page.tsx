import { ChipList } from "@/components/common/Browse";
import { getGenres } from "@/lib/server-api";

export const revalidate = 3600;

export default async function GenresPage() {
  let genres: { name: string; slug: string }[] = [];
  try {
    genres = await getGenres();
  } catch {
    genres = [];
  }
  return <ChipList heading="Thể loại" items={genres} basePath="/genres" />;
}
