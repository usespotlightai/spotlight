export interface FrontierPoint {
  readonly seed: boolean;
  readonly finished: boolean;
  readonly searchScore: number | null;
  readonly costPerRun: number | null;
}

const rateOf = (point: FrontierPoint): number =>
  point.searchScore ?? Number.NEGATIVE_INFINITY;

const costOf = (point: FrontierPoint): number =>
  point.costPerRun ?? Number.POSITIVE_INFINITY;

const dominates = (one: FrontierPoint, other: FrontierPoint): boolean =>
  rateOf(one) >= rateOf(other) &&
  costOf(one) <= costOf(other) &&
  (rateOf(one) > rateOf(other) || costOf(one) < costOf(other));

export const frontierOf = <Point extends FrontierPoint>(
  points: readonly Point[],
): readonly Point[] => {
  const standing = points.filter(
    (each) => each.seed || (each.finished && each.searchScore !== null),
  );

  return standing
    .filter(
      (each) => each.seed || !standing.some((other) => dominates(other, each)),
    )
    .sort(
      (one, other) =>
        costOf(one) - costOf(other) || rateOf(other) - rateOf(one) || 0,
    );
};
