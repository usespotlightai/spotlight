import { InsightsTileSkeleton } from '@/components/features/insights/InsightsTileSkeleton';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
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
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder tiles keep their place
        <InsightsTileSkeleton key={at} {...tile} />
      ))}
    </InsightsTiles>
  );
}
