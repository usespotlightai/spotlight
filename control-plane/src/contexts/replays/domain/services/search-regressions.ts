import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { taskComparisons } from '@replays/domain/services/replay-results';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface SearchRegressions {
  readonly searched: number | null;
  readonly heldOut: number | null;
  readonly total: number | null;
}

export const regressionsOf = (
  searched: number | null,
  heldOut: number | null,
): SearchRegressions => ({
  searched,
  heldOut,
  total:
    searched === null && heldOut === null
      ? null
      : (searched ?? 0) + (heldOut ?? 0),
});

export const NO_REGRESSIONS = regressionsOf(null, null);

export const countRegressions = (
  candidate: Replay,
  seed: Replay,
  runSubset: readonly RunId[],
): number =>
  taskComparisons(candidate, seed, runSubset).filter((each) => each.regressed)
    .length;

export const exceedsRegressionLimit = (
  regressions: SearchRegressions,
  threshold: ReplayThreshold | null,
): boolean =>
  threshold !== null &&
  regressions.total !== null &&
  !threshold.allows(regressions.total);

export interface RegressionLimit {
  readonly maxRegressions: number | null;
  readonly exceedsRegressionLimit: boolean;
}

export const regressionLimitOf = (
  regressions: SearchRegressions,
  threshold: ReplayThreshold | null,
): RegressionLimit => ({
  maxRegressions: threshold?.maxRegressions ?? null,
  exceedsRegressionLimit: exceedsRegressionLimit(regressions, threshold),
});
