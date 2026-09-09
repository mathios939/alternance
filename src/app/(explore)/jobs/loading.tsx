import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonList } from "@/components/shared/skeleton-card";

export default function JobsLoading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <Skeleton className="mb-5 h-14 max-w-3xl rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(380px,1fr)_minmax(420px,1.2fr)]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <SkeletonList count={5} />
        <Skeleton className="hidden h-[70vh] rounded-xl xl:block" />
      </div>
    </div>
  );
}
