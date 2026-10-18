import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const MAX_JOB_ATTEMPTS = 4;

export const JOB_LEASE_MS = 30 * 60 * 1000;

export const JOB_BACKOFF_MS = 30_000;

export class PendingJob {
  private constructor(
    readonly attempts: number,
    readonly nextAttemptAt: Date | null,
  ) {}

  static fresh(): PendingJob {
    return new PendingJob(0, null);
  }

  static rehydrate(input: {
    attempts: number;
    nextAttemptAt: Date | null;
  }): PendingJob {
    if (!Number.isInteger(input.attempts) || input.attempts < 0) {
      throw new InconsistentStateError(
        'pending job',
        `has been attempted ${input.attempts} times`,
      );
    }

    return new PendingJob(input.attempts, input.nextAttemptAt);
  }

  get exhausted(): boolean {
    return this.attempts >= MAX_JOB_ATTEMPTS;
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
    );
  }

  scheduleRetryAt(at: Date): PendingJob {
    return new PendingJob(this.attempts, at);
  }

  scheduleRetry(now: Date): PendingJob {
    return new PendingJob(
      this.attempts,
      new Date(
        now.getTime() + JOB_BACKOFF_MS * 2 ** Math.max(0, this.attempts - 1),
      ),
    );
  }
}
