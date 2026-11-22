import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const MAX_JOB_ATTEMPTS = 4;

export const JOB_LEASE_MS = 30 * 60 * 1000;

export const JOB_BACKOFF_MS = 30_000;

/** How long a waiting job sleeps before its loop looks again, unless something wakes it sooner. */
export const WAIT_MS = 60_000;

/** How long a job may keep waiting before it is exhausted. */
export const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

export class PendingJob {
  private constructor(
    readonly attempts: number,
    readonly nextAttemptAt: Date | null,
    /** When the job began to wait, kept across its waits until it is retried. Null when it is not waiting. */
    readonly waitingSince: Date | null,
  ) {}

  static fresh(): PendingJob {
    return new PendingJob(0, null, null);
  }

  static rehydrate(input: {
    attempts: number;
    nextAttemptAt: Date | null;
    waitingSince: Date | null;
  }): PendingJob {
    if (!Number.isInteger(input.attempts) || input.attempts < 0) {
      throw new InconsistentStateError(
        'pending job',
        `has been attempted ${input.attempts} times`,
      );
    }

    return new PendingJob(
      input.attempts,
      input.nextAttemptAt,
      input.waitingSince,
    );
  }

  /** Out of attempts, or its next attempt comes more than `MAX_WAIT_MS` after it began to wait. */
  get exhausted(): boolean {
    const { waitingSince, nextAttemptAt } = this;

    return (
      this.attempts >= MAX_JOB_ATTEMPTS ||
      (waitingSince !== null &&
        nextAttemptAt !== null &&
        nextAttemptAt.getTime() - waitingSince.getTime() > MAX_WAIT_MS)
    );
  }

  isDue(now: Date): boolean {
    return (
      this.nextAttemptAt === null ||
      this.nextAttemptAt.getTime() <= now.getTime()
    );
  }

  lease(now: Date): PendingJob {
    return new PendingJob(
      this.attempts + 1,
      new Date(now.getTime() + JOB_LEASE_MS),
      this.waitingSince,
    );
  }

  renewLease(now: Date): PendingJob {
    return new PendingJob(
      this.attempts,
      new Date(now.getTime() + JOB_LEASE_MS),
      this.waitingSince,
    );
  }

  /** Hands back the attempt the lease counted and looks again in `WAIT_MS`: waiting costs no attempt, only time. */
  wait(now: Date): PendingJob {
    return new PendingJob(
      Math.max(0, this.attempts - 1),
      new Date(now.getTime() + WAIT_MS),
      this.waitingSince ?? now,
    );
  }

  /**
   * Whether the job sleeps between two looks at what it waits for. A leased job also keeps `waitingSince`, but
   * its next attempt is a lease away (`JOB_LEASE_MS`), never within `WAIT_MS`.
   */
  isWaiting(now: Date): boolean {
    return (
      this.waitingSince !== null &&
      this.nextAttemptAt !== null &&
      this.nextAttemptAt.getTime() - now.getTime() <= WAIT_MS
    );
  }

  /** Makes a waiting job due now, because what it waits for has settled. Any other job stays as it is. */
  wake(now: Date): PendingJob {
    return this.isWaiting(now)
      ? new PendingJob(this.attempts, now, this.waitingSince)
      : this;
  }

  scheduleRetryAt(at: Date): PendingJob {
    return new PendingJob(this.attempts, at, null);
  }

  scheduleRetry(now: Date): PendingJob {
    return new PendingJob(
      this.attempts,
      new Date(
        now.getTime() + JOB_BACKOFF_MS * 2 ** Math.max(0, this.attempts - 1),
      ),
      null,
    );
  }
}
