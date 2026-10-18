import { InsightsTileSkeleton } from '@/components/features/insights/InsightsTileSkeleton';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import type { TileBones } from '@/lib/insights-tiles';

type InsightsTilesSkeletonProps = {
  label: string;
  tiles: readonly TileBones[];
};

export function InsightsTilesSkeleton({
  label,
  tiles,
}: InsightsTilesSkeletonProps) {
  return (
    <InsightsTiles label={label}>
      {tiles.map((tile, at) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder tiles keep their place
        <InsightsTileSkeleton key={at} {...tile} />
      ))}
    </InsightsTiles>
  );
}
