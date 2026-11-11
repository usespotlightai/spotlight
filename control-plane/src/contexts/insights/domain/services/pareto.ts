import { dominates } from '@shared-kernel/domain/services/pareto-dominance';

export interface Placed {
  readonly id: string;
  readonly cost: number;
  readonly value: number;
}

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
