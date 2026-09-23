import type { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const DECISION_STANDINGS = ['proposed', 'stands'] as const;

export type DecisionStandingState = (typeof DECISION_STANDINGS)[number];

export class DecisionStanding {
  private constructor(
    readonly state: DecisionStandingState,
    readonly merge: DecisionMerge | null,
  ) {}

  static proposed(): DecisionStanding {
    return new DecisionStanding('proposed', null);
  }

  static stood(merge: DecisionMerge): DecisionStanding {
    return new DecisionStanding('stands', merge);
  }

  static rehydrate(input: {
    state: DecisionStandingState;
    merge: DecisionMerge | null;
  }): DecisionStanding {
    if ((input.state === 'stands') !== (input.merge !== null)) {
      throw new InconsistentStateError(
        'decision set',
        'stands without the merge it stood in, or holds a merge while proposed',
      );
    }

    return new DecisionStanding(input.state, input.merge);
  }

  get stands(): boolean {
    return this.state === 'stands';
  }
}
