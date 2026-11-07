import { groupedBy } from '@change-review/domain/services/grouped-by';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';

export interface Placement {
  readonly hunk: string;
  readonly cohort: number;
  readonly layer: number;
}

export const placementsOf = (
  cohorts: readonly ProposedCohort[],
): Map<string, Placement[]> =>
  groupedBy(
    cohorts.flatMap((cohort, c) =>
      cohort.layers.flatMap((layer, l) =>
        layer.hunks.map((entry) => ({
          hunk: entry.hunk,
          cohort: c,
          layer: l,
        })),
      ),
    ),
    (placement) => placement.hunk,
  );
