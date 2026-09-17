import type {
  StackCheck,
  StackCheckState,
} from '@change-review/domain/value-objects/stack-check.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const CHANGE_STACK_STATES = ['drafting', 'ready', 'failed'] as const;

export type ChangeStackState = (typeof CHANGE_STACK_STATES)[number];

export const CHECKING_LIMIT_MS = 60 * 60 * 1000;

export const INTERRUPTED = 'Drafting was interrupted before it finished.';

export const UNCHECKED = 'No runner checked the layers in time.';

export class StackProgress {
  private constructor(
    readonly state: ChangeStackState,
    readonly failure: string | null,
    readonly draftedAt: Date,
    readonly settledAt: Date | null,
    readonly check: StackCheck | null,
  ) {}

  static drafting(draftedAt: Date, check: StackCheck | null): StackProgress {
    return new StackProgress('drafting', null, draftedAt, null, check);
  }

  static rehydrate(input: {
    state: ChangeStackState;
    failure: string | null;
    draftedAt: Date;
    settledAt: Date | null;
    check: StackCheck | null;
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
      input.check,
    );
  }

  settled(
    state: Exclude<ChangeStackState, 'drafting'>,
    now: Date,
    change: { failure?: string; check?: StackCheck | null } = {},
  ): StackProgress {
    return new StackProgress(
      state,
      change.failure ?? null,
      this.draftedAt,
      now,
      change.check !== undefined ? change.check : this.check,
    );
  }

  checked(check: StackCheck): StackProgress {
    return new StackProgress(
      this.state,
      this.failure,
      this.draftedAt,
      this.settledAt,
      check,
    );
  }

  checkStateAt(now: Date): StackCheckState | null {
    if (!this.check || this.state !== 'ready') {
      return null;
    }

    const lapsed =
      this.settledAt !== null &&
      now.getTime() - this.settledAt.getTime() > CHECKING_LIMIT_MS;

    switch (this.check.phase) {
      case 'waiting':
        return lapsed ? 'skipped' : 'waiting';
      case 'reordering':
        return 'waiting';
      default:
        return this.check.phase;
    }
  }

  checkReasonAt(now: Date): string | null {
    return this.checkStateAt(now) === 'skipped'
      ? (this.check?.outcome?.reason ?? UNCHECKED)
      : (this.check?.outcome?.reason ?? null);
  }
}
