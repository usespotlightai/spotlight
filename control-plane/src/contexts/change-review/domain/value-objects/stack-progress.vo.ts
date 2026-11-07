import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const CHANGE_STACK_STATES = ['generating', 'ready', 'failed'] as const;

export type ChangeStackState = (typeof CHANGE_STACK_STATES)[number];

export const STACK_FAILURES = [
  'not-generated',
  'too-large',
  'broke-rules',
] as const;

export type StackFailure = (typeof STACK_FAILURES)[number];

export class StackProgress {
  private constructor(
    readonly state: ChangeStackState,
    readonly failure: StackFailure | null,
    readonly startedAt: Date,
    readonly completedAt: Date | null,
  ) {}

  static generating(startedAt: Date): StackProgress {
    return new StackProgress('generating', null, startedAt, null);
  }

  static rehydrate(input: {
    state: ChangeStackState;
    failure: StackFailure | null;
    startedAt: Date;
    completedAt: Date | null;
  }): StackProgress {
    if ((input.state === 'generating') !== (input.completedAt === null)) {
      throw new InconsistentStateError(
        'change stack',
        'is completed and generating at once',
      );
    }

    if ((input.state === 'failed') !== (input.failure !== null)) {
      throw new InconsistentStateError(
        'change stack',
        'has a failure that does not match its state',
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
    change: { failure?: StackFailure } = {},
  ): StackProgress {
    return new StackProgress(
      state,
      change.failure ?? null,
      this.startedAt,
      now,
    );
  }
}
