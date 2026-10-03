import type { GainVerdict } from '@replays/domain/services/gain-reading';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';

export interface RankedPoint {
  readonly candidateId: CandidateId;
  readonly seed: boolean;
  readonly searchScore: number | null;
  readonly heldOutScore: number | null;
  readonly searchedVerdict: GainVerdict | null;
  readonly heldOutVerdict: GainVerdict | null;
  readonly costPerRun: number | null;
}

const costOf = (point: RankedPoint): number =>
  point.costPerRun ?? Number.POSITIVE_INFINITY;

const cheaper = (one: RankedPoint, other: RankedPoint): number =>
  costOf(one) - costOf(other) || 0;

const inIdOrder = (one: RankedPoint, other: RankedPoint): number =>
  one.candidateId.value < other.candidateId.value
    ? -1
    : one.candidateId.value > other.candidateId.value
      ? 1
      : 0;

export const holdsSuccess = (
  verdict: GainVerdict | null,
  seed: boolean,
): boolean => seed || (verdict !== null && verdict !== 'worse');

export const rankedOf = <Point extends RankedPoint>(
  points: readonly Point[],
  objective: SearchObjective,
): readonly Point[] => {
  const heldOut = points.some(
    (each) => !each.seed && each.heldOutScore !== null,
  );
  const scoreOf = (each: Point): number | null =>
    heldOut ? each.heldOutScore : each.searchScore;
  const verdictOf = (each: Point): GainVerdict | null =>
    heldOut ? each.heldOutVerdict : each.searchedVerdict;
  const better = (one: Point, other: Point): number =>
    (scoreOf(other) as number) - (scoreOf(one) as number);
  const scored = points.filter((each) => scoreOf(each) !== null);

  return objective === 'cost'
    ? scored
        .filter((each) => holdsSuccess(verdictOf(each), each.seed))
        .sort(
          (one, other) =>
            cheaper(one, other) || better(one, other) || inIdOrder(one, other),
        )
    : scored.sort(
        (one, other) =>
          better(one, other) || cheaper(one, other) || inIdOrder(one, other),
      );
};
