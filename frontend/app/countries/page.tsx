import { BrowseIndex } from "@/components/common/BrowseIndex";
import { ErrorState } from "@/components/common/States";
import { getCountries } from "@/lib/server-api";

export const revalidate = 3600;

export const metadata = { title: "Quốc gia" };

export default async function CountriesPage() {
  let countries: { name: string; slug: string }[] = [];
  let failed = false;
  try {
    countries = await getCountries();
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <ErrorState
        className="mt-8"
        title="Không tải được danh sách quốc gia"
        description="Nguồn dữ liệu đang gặp sự cố. Vui lòng thử lại sau."
      />
    );
  }

  return (
    <BrowseIndex
      heading="Quốc gia"
      description="Phim theo từng quốc gia sản xuất"
      items={countries}
      basePath="/countries"
      variant="card"
    />
  );
}
