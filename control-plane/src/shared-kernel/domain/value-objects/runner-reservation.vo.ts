import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const CLAIM_WITHIN_MS = 5 * 60_000;

export class RunnerReservation {
  private constructor(
    readonly runner: RunnerId,
    readonly pool: string,
    readonly until: Date,
  ) {}

  static from(runner: RunnerId, pool: string, now: Date): RunnerReservation {
    return RunnerReservation.of(
      runner,
      pool,
      new Date(now.getTime() + CLAIM_WITHIN_MS),
    );
  }

  static of(runner: RunnerId, pool: string, until: Date): RunnerReservation {
    if (pool.trim().length === 0) {
      throw new InconsistentStateError(
        'runner reservation',
        'names no pool that provisions its runner',
      );
    }

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
      this.pool === other.pool &&
      this.until.getTime() === other.until.getTime()
    );
  }
}
