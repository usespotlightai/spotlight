import {
  RunnerClaim,
  type RunnerLease,
  isLeaseActiveAt,
} from '@change-review/domain/value-objects/runner-claim.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';

export const WAITING_LIMIT_MS = 60 * 60 * 1000;

export const waitExpiredSince = (
  since: Date,
  lease: RunnerLease,
  now: Date,
): boolean =>
  now.getTime() - since.getTime() > WAITING_LIMIT_MS &&
  !isLeaseActiveAt(lease, now);

export class RunnerAssignment {
  private constructor(
    readonly claim: RunnerClaim,
    readonly reservation: RunnerReservation | null,
    readonly provisioning: Provisioning,
  ) {}

  static none(): RunnerAssignment {
    return new RunnerAssignment(RunnerClaim.none(), null, Provisioning.none());
  }

  static of(input: {
    claim: RunnerClaim;
    reservation: RunnerReservation | null;
    provisioning: Provisioning;
  }): RunnerAssignment {
    return new RunnerAssignment(
      input.claim,
      input.reservation,
      input.provisioning,
    );
  }

  get holdsRunner(): boolean {
    return this.claim.claimedBy !== null || this.reservation !== null;
  }

  isLeasedAt(now: Date): boolean {
    return this.claim.isLeasedAt(now);
  }

  isLeasedBy(runner: RunnerId, now: Date): boolean {
    return this.claim.isLeasedBy(runner, now);
  }

  isReservedAt(now: Date): boolean {
    return this.reservation?.isActiveAt(now) ?? false;
  }

  isReservedFor(runner: RunnerId): boolean {
    return this.reservation?.isFor(runner) ?? false;
  }

  reservationExpiredAt(now: Date): boolean {
    return this.reservation !== null && !this.reservation.isActiveAt(now);
  }

  claimableAt(now: Date, by: RunnerId | null): boolean {
    return (
      !this.claim.isLeasedAt(now) &&
      !this.claim.exhausted &&
      (!this.isReservedAt(now) || (by !== null && this.isReservedFor(by)))
    );
  }

  provisionableAt(now: Date): boolean {
    return (
      this.claimableAt(now, null) &&
      this.reservation === null &&
      this.provisioning.isDue(now)
    );
  }

  takesProvisionFailureFrom(runner: RunnerId, now: Date): boolean {
    return this.isReservedFor(runner) && !this.claim.isLeasedAt(now);
  }

  claimedBy(runner: RunnerId, now: Date): RunnerAssignment {
    return new RunnerAssignment(
      this.claim.claimed(runner, now),
      null,
      this.provisioning,
    );
  }

  reservedFor(runner: RunnerId, pool: PoolId, now: Date): RunnerAssignment {
    return new RunnerAssignment(
      this.claim,
      RunnerReservation.from(runner, pool, now),
      this.provisioning,
    );
  }

  withoutReservation(): RunnerAssignment {
    return new RunnerAssignment(this.claim, null, this.provisioning);
  }

  provisionFailedAt(failure: ProvisionFailure, now: Date): RunnerAssignment {
    return new RunnerAssignment(
      this.claim,
      null,
      this.provisioning.recordFailure(failure, now),
    );
  }

  renewed(now: Date): RunnerAssignment {
    return this.withClaim(this.claim.renewed(now));
  }

  unclaimed(): RunnerAssignment {
    return this.withClaim(this.claim.unclaimed());
  }

  released(): RunnerAssignment {
    return this.withClaim(this.claim.released());
  }

  restarted(): RunnerAssignment {
    return new RunnerAssignment(RunnerClaim.none(), null, Provisioning.none());
  }

  private withClaim(claim: RunnerClaim): RunnerAssignment {
    return new RunnerAssignment(claim, this.reservation, this.provisioning);
  }
}
