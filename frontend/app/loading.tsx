export default function HomeLoading() {
  return (
    <div className="space-y-10 pt-6">
      <div className="aspect-[21/9] w-full animate-pulse rounded-2xl bg-neutral-800 sm:aspect-[21/7]" />
      {Array.from({ length: 3 }).map((_, row) => (
        <section key={row} className="space-y-3">
          <div className="h-5 w-36 animate-pulse rounded bg-neutral-800" />
          <div className="-mx-4 flex gap-4 overflow-hidden px-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-36 shrink-0 space-y-2 sm:w-44 lg:w-48">
                <div className="aspect-[2/3] animate-pulse rounded-lg bg-neutral-800" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-800" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
