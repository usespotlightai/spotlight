import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const MOST_CHECK_ATTEMPTS = 3;

const CHECK_LEASE_MS = 10 * 60 * 1000;

export const MOST_HOLD_MS = 65 * 60 * 1000;

export interface CheckHold {
  readonly leaseExpiresAt: Date | null;
  readonly claimedAt: Date | null;
}

const heldTooLongAt = (claimedAt: Date, now: Date): boolean =>
  now.getTime() - claimedAt.getTime() >= MOST_HOLD_MS;

export const holdsAt = (hold: CheckHold, now: Date): boolean =>
  hold.leaseExpiresAt !== null &&
  hold.claimedAt !== null &&
  hold.leaseExpiresAt.getTime() > now.getTime() &&
  !heldTooLongAt(hold.claimedAt, now);

export class CheckClaim implements CheckHold {
  private constructor(
    readonly claimedBy: RunnerId | null,
    readonly attempts: number,
    readonly leaseExpiresAt: Date | null,
    readonly claimedAt: Date | null,
  ) {}

  static none(): CheckClaim {
    return new CheckClaim(null, 0, null, null);
  }

  static rehydrate(input: {
    claimedBy: RunnerId | null;
    attempts: number;
    leaseExpiresAt: Date | null;
    claimedAt: Date | null;
  }): CheckClaim {
    if (!Number.isInteger(input.attempts) || input.attempts < 0) {
      throw new InconsistentStateError(
        'change stack check',
        `has been claimed ${input.attempts} times`,
      );
    }
    if (
      (input.claimedBy === null) !== (input.leaseExpiresAt === null) ||
      (input.claimedBy === null) !== (input.claimedAt === null)
    ) {
      throw new InconsistentStateError(
        'change stack check',
        'is claimed with no lease or no time it was claimed, or leased to nobody',
      );
    }

    return new CheckClaim(
      input.claimedBy,
      input.attempts,
      input.leaseExpiresAt,
      input.claimedAt,
    );
  }

  get exhausted(): boolean {
    return this.attempts >= MOST_CHECK_ATTEMPTS;
  }

  heldAt(now: Date): boolean {
    return holdsAt(this, now);
  }

  heldBy(runner: RunnerId, now: Date): boolean {
    return this.heldAt(now) && this.claimedBy?.equals(runner) === true;
  }

  claimed(runner: RunnerId, now: Date): CheckClaim {
    return new CheckClaim(
      runner,
      this.attempts + 1,
      new Date(now.getTime() + CHECK_LEASE_MS),
      now,
    );
  }

  renewed(now: Date): CheckClaim {
    if (this.claimedBy === null || this.claimedAt === null) {
      throw new InconsistentStateError(
        'change stack check',
        'has no claim to renew',
      );
    }
    if (heldTooLongAt(this.claimedAt, now)) {
      throw InvalidChangeStackError.because(
        'has been held for as long as a check may be held',
      );
    }

    return new CheckClaim(
      this.claimedBy,
      this.attempts,
      new Date(now.getTime() + CHECK_LEASE_MS),
      this.claimedAt,
    );
  }

  unclaimed(): CheckClaim {
    if (this.claimedBy === null) {
      throw new InconsistentStateError(
        'change stack check',
        'has no claim to undo',
      );
    }

    return new CheckClaim(null, this.attempts - 1, null, null);
  }

  released(): CheckClaim {
    return new CheckClaim(null, this.attempts, null, null);
  }
}
