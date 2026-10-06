import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { tilesInARow } from '@/lib/insights-tiles';
import { cn } from '@/lib/utils';

export function InsightsTilesSkeleton({ count }: { count: number }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 sm:grid-cols-3',
        tilesInARow(count),
      )}
    >
      {Array.from({ length: count }, (_, at) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder tiles have no identity
          key={at}
          className="h-24 rounded-lg"
        />
      ))}
    </div>
  );
}
