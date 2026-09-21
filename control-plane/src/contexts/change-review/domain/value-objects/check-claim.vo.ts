import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const MOST_CHECK_ATTEMPTS = 3;

const CHECK_LEASE_MS = 10 * 60 * 1000;

export class CheckClaim {
  private constructor(
    readonly claimedBy: RunnerId | null,
    readonly attempts: number,
    readonly leaseExpiresAt: Date | null,
  ) {}

  static none(): CheckClaim {
    return new CheckClaim(null, 0, null);
  }

  static rehydrate(input: {
    claimedBy: RunnerId | null;
    attempts: number;
    leaseExpiresAt: Date | null;
  }): CheckClaim {
    if (!Number.isInteger(input.attempts) || input.attempts < 0) {
      throw new InconsistentStateError(
        'change stack check',
        `has been claimed ${input.attempts} times`,
      );
    }
    if ((input.claimedBy === null) !== (input.leaseExpiresAt === null)) {
      throw new InconsistentStateError(
        'change stack check',
        'is claimed with no lease, or leased to nobody',
      );
    }

    return new CheckClaim(
      input.claimedBy,
      input.attempts,
      input.leaseExpiresAt,
    );
  }

  get exhausted(): boolean {
    return this.attempts >= MOST_CHECK_ATTEMPTS;
  }

  heldAt(now: Date): boolean {
    return (
      this.leaseExpiresAt !== null &&
      this.leaseExpiresAt.getTime() > now.getTime()
    );
  }

  heldBy(runner: RunnerId, now: Date): boolean {
    return this.heldAt(now) && this.claimedBy?.equals(runner) === true;
  }

  claimed(runner: RunnerId, now: Date): CheckClaim {
    return new CheckClaim(
      runner,
      this.attempts + 1,
      new Date(now.getTime() + CHECK_LEASE_MS),
    );
  }

  renewed(now: Date): CheckClaim {
    if (this.claimedBy === null) {
      throw new InconsistentStateError(
        'change stack check',
        'has no claim to renew',
      );
    }

    return new CheckClaim(
      this.claimedBy,
      this.attempts,
      new Date(now.getTime() + CHECK_LEASE_MS),
    );
  }

  released(): CheckClaim {
    return new CheckClaim(null, this.attempts, null);
  }
}
