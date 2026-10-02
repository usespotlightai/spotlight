import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';

export interface RankedPoint {
  readonly candidateId: CandidateId;
  readonly seed: boolean;
  readonly searchScore: number | null;
  readonly heldOutScore: number | null;
  readonly costPerRun: number | null;
}

const cheaper = (one: RankedPoint, other: RankedPoint): number =>
  (one.costPerRun ?? Number.POSITIVE_INFINITY) -
    (other.costPerRun ?? Number.POSITIVE_INFINITY) || 0;

const inIdOrder = (one: RankedPoint, other: RankedPoint): number =>
  one.candidateId.value < other.candidateId.value
    ? -1
    : one.candidateId.value > other.candidateId.value
      ? 1
      : 0;

export const rankedOf = <Point extends RankedPoint>(
  points: readonly Point[],
): readonly Point[] => {
  const heldOut = points.some(
    (each) => !each.seed && each.heldOutScore !== null,
  );
  const scoreOf = (each: Point): number | null =>
    heldOut ? each.heldOutScore : each.searchScore;

  return points
    .filter((each) => scoreOf(each) !== null)
    .sort(
      (one, other) =>
        (scoreOf(other) as number) - (scoreOf(one) as number) ||
        cheaper(one, other) ||
        inIdOrder(one, other),
    );
};
