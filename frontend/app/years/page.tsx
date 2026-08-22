import { ChipList } from "@/components/common/Browse";
import { ErrorState } from "@/components/common/States";
import { getYears } from "@/lib/server-api";

export const revalidate = 3600;

export const metadata = { title: "Năm phát hành" };

export default async function YearsPage() {
  let years: { name: string; slug: string }[] = [];
  let failed = false;
  try {
    years = await getYears();
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <ErrorState
        className="mt-8"
        title="Không tải được danh sách năm phát hành"
        description="Nguồn dữ liệu đang gặp sự cố. Vui lòng thử lại sau."
      />
    );
  }

  return (
    <ChipList
      heading="Năm phát hành"
      description={`${years.length} năm để bạn khám phá`}
      items={years}
      basePath="/years"
    />
  );
}
