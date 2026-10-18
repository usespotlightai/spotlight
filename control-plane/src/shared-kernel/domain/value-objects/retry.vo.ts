import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class Retry {
  private constructor(
    readonly maxAttempts: number,
    readonly initialDelayMs: number,
    readonly maxDelayMs: number,
  ) {}

  static never(): Retry {
    return new Retry(1, 0, 0);
  }

  static backoff(input: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
  }): Retry {
    if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 2) {
      throw new InconsistentStateError(
        'retry',
        `must allow at least one more attempt, not ${input.maxAttempts} in all`,
      );
    }

    if (input.initialDelayMs < 0 || input.maxDelayMs < input.initialDelayMs) {
      throw new InconsistentStateError(
        'retry',
        `cannot wait from ${input.initialDelayMs}ms up to ${input.maxDelayMs}ms`,
      );
    }

    return new Retry(input.maxAttempts, input.initialDelayMs, input.maxDelayMs);
  }

  get allowsRetry(): boolean {
    return this.maxAttempts > 1;
  }

  exhaustedAfter(attempts: number): boolean {
    return attempts >= this.maxAttempts;
  }

  nextAttemptAt(attempts: number, now: Date): Date | null {
    if (this.exhaustedAfter(attempts)) {
      return null;
    }

    const wait = Math.min(
      this.initialDelayMs * 2 ** (Math.max(attempts, 1) - 1),
      this.maxDelayMs,
    );

    return new Date(now.getTime() + wait);
  }

  equals(other: Retry): boolean {
    return (
      this.maxAttempts === other.maxAttempts &&
      this.initialDelayMs === other.initialDelayMs &&
      this.maxDelayMs === other.maxDelayMs
    );
  }
}
