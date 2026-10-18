import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const CHANGE_STACK_STATES = ['generating', 'ready', 'failed'] as const;

export type ChangeStackState = (typeof CHANGE_STACK_STATES)[number];

export const INTERRUPTED = 'Generation was interrupted before it finished.';

export class StackProgress {
  private constructor(
    readonly state: ChangeStackState,
    readonly failure: string | null,
    readonly startedAt: Date,
    readonly completedAt: Date | null,
  ) {}

  static generating(startedAt: Date): StackProgress {
    return new StackProgress('generating', null, startedAt, null);
  }

  static rehydrate(input: {
    state: ChangeStackState;
    failure: string | null;
    startedAt: Date;
    completedAt: Date | null;
  }): StackProgress {
    if ((input.state === 'generating') !== (input.completedAt === null)) {
      throw new InconsistentStateError(
        'change stack',
        'is completed and generating at once',
      );
    }

    return new StackProgress(
      input.state,
      input.failure,
      input.startedAt,
      input.completedAt,
    );
  }

  complete(
    state: Exclude<ChangeStackState, 'generating'>,
    now: Date,
    change: { failure?: string } = {},
  ): StackProgress {
    return new StackProgress(
      state,
      change.failure ?? null,
      this.startedAt,
      now,
    );
  }
}
