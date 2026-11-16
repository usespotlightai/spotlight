import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const MAX_ATTEMPTS = 3;

const LEASE_MS = 10 * 60 * 1000;

export const MAX_LEASE_MS = 65 * 60 * 1000;

export interface RunnerLease {
  readonly leaseExpiresAt: Date | null;
  readonly claimedAt: Date | null;
}

const leasedTooLongAt = (claimedAt: Date, now: Date): boolean =>
  now.getTime() - claimedAt.getTime() >= MAX_LEASE_MS;

export const isLeaseActiveAt = (lease: RunnerLease, now: Date): boolean =>
  lease.leaseExpiresAt !== null &&
  lease.claimedAt !== null &&
  lease.leaseExpiresAt.getTime() > now.getTime() &&
  !leasedTooLongAt(lease.claimedAt, now);

export class RunnerClaim implements RunnerLease {
  private constructor(
    readonly claimedBy: RunnerId | null,
    readonly attempts: number,
    readonly leaseExpiresAt: Date | null,
    readonly claimedAt: Date | null,
  ) {}

  static none(): RunnerClaim {
    return new RunnerClaim(null, 0, null, null);
  }

  static rehydrate(input: {
    claimedBy: RunnerId | null;
    attempts: number;
    leaseExpiresAt: Date | null;
    claimedAt: Date | null;
  }): RunnerClaim {
    if (!Number.isInteger(input.attempts) || input.attempts < 0) {
      throw new InconsistentStateError(
        'runner claim',
        `has been claimed ${input.attempts} times`,
      );
    }
    if (
      (input.claimedBy === null) !== (input.leaseExpiresAt === null) ||
      (input.claimedBy === null) !== (input.claimedAt === null)
    ) {
      throw new InconsistentStateError(
        'runner claim',
        'is claimed with no lease or no time it was claimed, or leased to nobody',
      );
    }

    return new RunnerClaim(
      input.claimedBy,
      input.attempts,
      input.leaseExpiresAt,
      input.claimedAt,
    );
  }

  get exhausted(): boolean {
    return this.attempts >= MAX_ATTEMPTS;
  }

  isLeasedAt(now: Date): boolean {
    return isLeaseActiveAt(this, now);
  }

  isLeasedBy(runner: RunnerId, now: Date): boolean {
    return this.isLeasedAt(now) && this.claimedBy?.equals(runner) === true;
  }

  claimed(runner: RunnerId, now: Date): RunnerClaim {
    return new RunnerClaim(
      runner,
      this.attempts + 1,
      new Date(now.getTime() + LEASE_MS),
      now,
    );
  }

  renewed(now: Date): RunnerClaim {
    if (this.claimedBy === null || this.claimedAt === null) {
      throw new InconsistentStateError('runner claim', 'has no claim to renew');
    }
    if (leasedTooLongAt(this.claimedAt, now)) {
      throw new InconsistentStateError(
        'runner claim',
        'is renewed past the longest lease',
      );
    }

    return new RunnerClaim(
      this.claimedBy,
      this.attempts,
      new Date(now.getTime() + LEASE_MS),
      this.claimedAt,
    );
  }

  unclaimed(): RunnerClaim {
    if (this.claimedBy === null) {
      throw new InconsistentStateError('runner claim', 'has no claim to undo');
    }

    return new RunnerClaim(null, this.attempts - 1, null, null);
  }

  released(): RunnerClaim {
    return new RunnerClaim(null, this.attempts, null, null);
  }
}
