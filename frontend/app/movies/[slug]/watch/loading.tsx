export default function WatchLoading() {
  return (
    <div className="space-y-4 pt-6">
      <div className="h-4 w-48 animate-pulse rounded bg-neutral-800" />
      <div className="aspect-video w-full animate-pulse rounded-xl bg-neutral-800" />
      <div className="h-4 w-32 animate-pulse rounded bg-neutral-800" />
      <div className="flex gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-9 w-14 animate-pulse rounded-lg bg-neutral-800" />
        ))}
      </div>
    </div>
  );
}
