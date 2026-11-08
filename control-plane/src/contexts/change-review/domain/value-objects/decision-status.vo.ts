import type { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export const DECISION_STATUSES = ['proposed', 'merged'] as const;

export type DecisionStatusValue = (typeof DECISION_STATUSES)[number];

export class DecisionStatus {
  private constructor(readonly merges: readonly DecisionMerge[]) {}

  static proposed(): DecisionStatus {
    return new DecisionStatus([]);
  }

  static rehydrate(input: {
    state: DecisionStatusValue;
    merges: readonly DecisionMerge[];
  }): DecisionStatus {
    if ((input.state === 'merged') !== input.merges.length > 0) {
      throw new InconsistentStateError(
        'decision set',
        'is merged without a merge commit, or has a merge while proposed',
      );
    }

    const merges = [...input.merges].sort(
      (a, b) => a.at.getTime() - b.at.getTime(),
    );

    if (
      merges.some((each, index) =>
        merges
          .slice(0, index)
          .some((earlier) => earlier.repository.equals(each.repository)),
      )
    ) {
      throw new InconsistentStateError(
        'decision set',
        'merged twice into the same repository',
      );
    }

    return new DecisionStatus(merges);
  }

  get state(): DecisionStatusValue {
    return this.merges.length > 0 ? 'merged' : 'proposed';
  }

  get isMerged(): boolean {
    return this.merges.length > 0;
  }

  mergeIn(repository: Repository): DecisionMerge | null {
    return (
      this.merges.find((each) => each.repository.equals(repository)) ?? null
    );
  }

  merged(merge: DecisionMerge): DecisionStatus {
    return this.mergeIn(merge.repository)
      ? this
      : new DecisionStatus([...this.merges, merge]);
  }
}
