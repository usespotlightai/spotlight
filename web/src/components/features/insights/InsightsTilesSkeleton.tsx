import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { InsightsTileSkeleton } from '@/components/features/insights/InsightsTileSkeleton';
import type { TileBones } from '@/lib/insights-tiles';

type InsightsTilesSkeletonProps = {
  label: string;
  tiles: readonly TileBones[];
  className?: string;
};

export function InsightsTilesSkeleton({
  label,
  tiles,
  className,
}: InsightsTilesSkeletonProps) {
  return (
    <InsightsTiles label={label} className={className}>
      {tiles.map((tile, at) => (
        // oxlint-disable-next-line react/no-array-index-key -- placeholder tiles keep their place
        <InsightsTileSkeleton key={at} {...tile} />
      ))}
    </InsightsTiles>
  );
}
