import type { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const MAX_ATTEMPTS = 6;

const MAX_WAITS_FOR_THREAD = 30;

const BACKOFF_MS = 30_000;

const WAIT_MS = 60_000;

export interface DeliveryRetry {
  readonly at: Date;
  readonly counted: boolean;
}

const after = (now: Date, ms: number): Date => new Date(now.getTime() + ms);

export class DeliveryAttempts {
  private constructor(readonly made: number) {}

  static of(made: number): DeliveryAttempts {
    if (!Number.isInteger(made) || made < 0) {
      throw new InconsistentStateError(
        'review delivery',
        `has made ${made} attempts`,
      );
    }

    return new DeliveryAttempts(made);
  }

  untilPullRequest(now: Date): DeliveryRetry {
    return { at: after(now, WAIT_MS), counted: false };
  }

  retryAfter(failure: DeliveryFailure, now: Date): DeliveryRetry | null {
    const made = this.made + 1;

    switch (failure.recovery) {
      case 'waits-for-thread':
        return made < MAX_WAITS_FOR_THREAD
          ? { at: after(now, WAIT_MS), counted: true }
          : null;
      case 'transient':
        return made < MAX_ATTEMPTS
          ? { at: after(now, BACKOFF_MS * 2 ** this.made), counted: true }
          : null;
      case 'permanent':
        return null;
    }
  }
}
