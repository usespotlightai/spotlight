import {
  FRONTIER_INK,
  REPLAYED_INK,
} from '@/components/features/insights/candidates/replayed-ink';
import {
  LIVE_REPLAYED,
  type ReplayedMark,
  type ReplayedPoint,
} from '@/lib/insights-candidates';
import { cn } from '@/lib/utils';

type ReplayedLegendProps = {
  points: readonly ReplayedPoint[];
  hollow?: boolean;
};

export function ReplayedLegend({
  points,
  hollow = false,
}: ReplayedLegendProps) {
  const onFrontier = (point: ReplayedPoint) => !hollow && point.frontier;
  const swatch = (shape: string, mark: ReplayedMark) =>
    cn(
      'size-2',
      shape,
      hollow ? REPLAYED_INK[mark].outline : REPLAYED_INK[mark].swatch,
    );
  const shows = {
    frontier: points.some(onFrontier),
    searched: points.some(
      (each) => each.mark === 'searched' && !onFrontier(each),
    ),
    proposed: points.some((each) => each.mark === 'proposed'),
    baseline: points.some((each) => each.mark === 'baseline'),
  };

  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
      {shows.frontier && (
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className={cn('size-2 rounded-full', FRONTIER_INK.swatch)}
          />
          On the search’s frontier
        </span>
      )}
      {shows.searched && (
        <span className="flex items-center gap-1">
          <span aria-hidden className={swatch('rounded-full', 'searched')} />
          Searched
        </span>
      )}
      {shows.proposed && (
        <span className="flex items-center gap-1">
          <span aria-hidden className={swatch('', 'proposed')} />
          Proposed
        </span>
      )}
      {shows.baseline && (
        <span className="flex items-center gap-1">
          <span aria-hidden className={swatch('rotate-45', 'baseline')} />
          {LIVE_REPLAYED}
        </span>
      )}
    </span>
  );
}
