import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const CHANGE_STACK_STATES = ['drafting', 'ready', 'failed'] as const;

export type ChangeStackState = (typeof CHANGE_STACK_STATES)[number];

export const INTERRUPTED = 'Drafting was interrupted before it finished.';

export class StackProgress {
  private constructor(
    readonly state: ChangeStackState,
    readonly failure: string | null,
    readonly draftedAt: Date,
    readonly completedAt: Date | null,
  ) {}

  static drafting(draftedAt: Date): StackProgress {
    return new StackProgress('drafting', null, draftedAt, null);
  }

  static rehydrate(input: {
    state: ChangeStackState;
    failure: string | null;
    draftedAt: Date;
    completedAt: Date | null;
  }): StackProgress {
    if ((input.state === 'drafting') !== (input.completedAt === null)) {
      throw new InconsistentStateError(
        'change stack',
        'is completed and drafting at once',
      );
    }

    return new StackProgress(
      input.state,
      input.failure,
      input.draftedAt,
      input.completedAt,
    );
  }

  complete(
    state: Exclude<ChangeStackState, 'drafting'>,
    now: Date,
    change: { failure?: string } = {},
  ): StackProgress {
    return new StackProgress(
      state,
      change.failure ?? null,
      this.draftedAt,
      now,
    );
  }
}
