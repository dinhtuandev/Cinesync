export default function DetailLoading() {
  return (
    <div className="pt-6">
      <div className="flex flex-col gap-6 rounded-2xl bg-neutral-900/60 p-6 sm:flex-row sm:p-10">
        <div className="aspect-[2/3] w-40 shrink-0 self-center animate-pulse rounded-xl bg-neutral-800 sm:self-start" />
        <div className="w-full space-y-3">
          <div className="h-8 w-2/3 animate-pulse rounded bg-neutral-800" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-800" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 w-16 animate-pulse rounded bg-neutral-800" />
            ))}
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-3 w-full animate-pulse rounded bg-neutral-800" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-800" />
            <div className="h-3 w-4/6 animate-pulse rounded bg-neutral-800" />
          </div>
          <div className="flex gap-3 pt-2">
            <div className="h-10 w-32 animate-pulse rounded-full bg-neutral-800" />
            <div className="h-10 w-28 animate-pulse rounded-full bg-neutral-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
