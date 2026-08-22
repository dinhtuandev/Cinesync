import { ChipList } from "@/components/common/Browse";
import { getCountries } from "@/lib/server-api";

export const revalidate = 3600;

export default async function CountriesPage() {
  let countries: { name: string; slug: string }[] = [];
  try {
    countries = await getCountries();
  } catch {
    countries = [];
  }
  return <ChipList heading="Quốc gia" items={countries} basePath="/countries" />;
}
