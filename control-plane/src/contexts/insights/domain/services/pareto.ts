export interface Placed {
  readonly id: string;
  readonly cost: number;
  readonly value: number;
}

const dominates = (one: Placed, other: Placed, higher: boolean): boolean => {
  const better = higher ? one.value >= other.value : one.value <= other.value;
  const strictly = higher ? one.value > other.value : one.value < other.value;

  return (
    one.cost <= other.cost && better && (one.cost < other.cost || strictly)
  );
};

export const paretoFrontier = (
  points: readonly Placed[],
  higherIsBetter: boolean,
): ReadonlySet<string> =>
  new Set(
    points
      .filter(
        (point) =>
          !points.some(
            (other) =>
              other.id !== point.id && dominates(other, point, higherIsBetter),
          ),
      )
      .map((each) => each.id),
  );
