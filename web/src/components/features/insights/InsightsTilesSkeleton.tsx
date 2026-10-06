import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { tilesInARow } from '@/lib/insights-tiles';
import { cn } from '@/lib/utils';

export function InsightsTilesSkeleton({
  labels,
}: {
  labels: readonly string[];
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 sm:grid-cols-3',
        tilesInARow(labels.length),
      )}
    >
      {labels.map((label) => (
        <div
          key={label}
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
        >
          <span className="flex min-h-7 items-center truncate border-border border-b bg-muted/40 px-2.5 py-1 text-foreground text-xs">
            {label}
          </span>
          <span className="flex flex-col gap-1 px-2.5 pt-2 pb-2">
            <SkeletonLine className="w-16 text-[1.375rem]" />
            <SkeletonLine className="w-24 text-xs" />
          </span>
        </div>
      ))}
    </div>
  );
}
