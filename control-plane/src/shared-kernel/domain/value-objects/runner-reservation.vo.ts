import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const CLAIM_WITHIN_MS = 5 * 60_000;

export class RunnerReservation {
  private constructor(
    readonly runner: RunnerId,
    readonly pool: PoolId,
    readonly until: Date,
  ) {}

  static from(runner: RunnerId, pool: PoolId, now: Date): RunnerReservation {
    return RunnerReservation.of(
      runner,
      pool,
      new Date(now.getTime() + CLAIM_WITHIN_MS),
    );
  }

  static of(runner: RunnerId, pool: PoolId, until: Date): RunnerReservation {
    return new RunnerReservation(runner, pool, until);
  }

  holdsAt(now: Date): boolean {
    return now.getTime() < this.until.getTime();
  }

  heldFor(runner: RunnerId): boolean {
    return this.runner.equals(runner);
  }

  equals(other: RunnerReservation): boolean {
    return (
      this.runner.equals(other.runner) &&
      this.pool.equals(other.pool) &&
      this.until.getTime() === other.until.getTime()
    );
  }
}
