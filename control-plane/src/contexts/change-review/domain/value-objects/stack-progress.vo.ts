import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const CHANGE_STACK_STATES = ['drafting', 'ready', 'failed'] as const;

export type ChangeStackState = (typeof CHANGE_STACK_STATES)[number];

export const INTERRUPTED = 'Drafting was interrupted before it finished.';

export class StackProgress {
  private constructor(
    readonly state: ChangeStackState,
    readonly failure: string | null,
    readonly draftedAt: Date,
    readonly settledAt: Date | null,
  ) {}

  static drafting(draftedAt: Date): StackProgress {
    return new StackProgress('drafting', null, draftedAt, null);
  }

  static rehydrate(input: {
    state: ChangeStackState;
    failure: string | null;
    draftedAt: Date;
    settledAt: Date | null;
  }): StackProgress {
    if ((input.state === 'drafting') !== (input.settledAt === null)) {
      throw new InconsistentStateError(
        'change stack',
        'is settled and drafting at once',
      );
    }

    return new StackProgress(
      input.state,
      input.failure,
      input.draftedAt,
      input.settledAt,
    );
  }

  settled(
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
