import type { GainSignificance } from '@replays/domain/services/gain-estimate';
import { isSuccess } from '@replays/domain/services/search-ranking';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { dominates } from '@shared-kernel/domain/services/pareto-dominance';

export interface FrontierPoint {
  readonly seed: boolean;
  readonly finished: boolean;
  readonly searchScore: number | null;
  readonly searchedSignificance: GainSignificance | null;
  readonly costPerRun: number | null;
}

const rateOf = (point: FrontierPoint): number =>
  point.searchScore ?? Number.NEGATIVE_INFINITY;

const costOf = (point: FrontierPoint): number =>
  point.costPerRun ?? Number.POSITIVE_INFINITY;

const placed = (point: FrontierPoint) => ({
  cost: costOf(point),
  value: rateOf(point),
});

export const frontierOf = <Point extends FrontierPoint>(
  points: readonly Point[],
  objective: SearchObjective,
): readonly Point[] => {
  const eligible = points.filter(
    (each) =>
      each.seed ||
      (each.finished &&
        each.searchScore !== null &&
        (objective === 'success' ||
          isSuccess(each.searchedSignificance, each.seed))),
  );

  return eligible
    .filter(
      (each) =>
        each.seed ||
        !eligible.some((other) => dominates(placed(other), placed(each), true)),
    )
    .sort(
      (one, other) =>
        costOf(one) - costOf(other) || rateOf(other) - rateOf(one) || 0,
    );
};
