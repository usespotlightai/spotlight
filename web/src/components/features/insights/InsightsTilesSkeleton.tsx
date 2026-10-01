import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function InsightsTilesSkeleton({
  labels,
}: {
  labels: readonly string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {labels.map((label) => (
        <div
          key={label}
          className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-card p-3"
        >
          <span className="truncate text-muted-foreground text-xs">
            {label}
          </span>
          <SkeletonLine className="w-14 text-xl" />
          <SkeletonLine className="w-20 text-xs" />
        </div>
      ))}
    </div>
  );
}
