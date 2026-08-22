import Link from "next/link";
import { getYears } from "@/lib/server-api";

export const revalidate = 3600;

export default async function YearsPage() {
  let years: { name: string; slug: string }[] = [];
  try {
    years = await getYears();
  } catch {
    years = [];
  }
  return (
    <div className="space-y-4 pt-6">
      <h1 className="text-lg font-semibold text-neutral-100">Năm phát hành</h1>
      <div className="flex flex-wrap gap-2">
        {years.map((y) => (
          <Link
            key={y.slug}
            href={`/years/${y.slug}`}
            className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-sm text-neutral-300 transition hover:border-rose-600 hover:text-white"
          >
            {y.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
