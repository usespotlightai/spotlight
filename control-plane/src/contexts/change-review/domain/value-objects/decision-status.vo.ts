import type { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const DECISION_STATUSES = ['proposed', 'merged'] as const;

export type DecisionStatusValue = (typeof DECISION_STATUSES)[number];

export class DecisionStatus {
  private constructor(
    readonly state: DecisionStatusValue,
    readonly merge: DecisionMerge | null,
  ) {}

  static proposed(): DecisionStatus {
    return new DecisionStatus('proposed', null);
  }

  static merged(merge: DecisionMerge): DecisionStatus {
    return new DecisionStatus('merged', merge);
  }

  static rehydrate(input: {
    state: DecisionStatusValue;
    merge: DecisionMerge | null;
  }): DecisionStatus {
    if ((input.state === 'merged') !== (input.merge !== null)) {
      throw new InconsistentStateError(
        'decision set',
        'is merged without a merge commit, or has a merge while proposed',
      );
    }

    return new DecisionStatus(input.state, input.merge);
  }

  get isMerged(): boolean {
    return this.state === 'merged';
  }
}
