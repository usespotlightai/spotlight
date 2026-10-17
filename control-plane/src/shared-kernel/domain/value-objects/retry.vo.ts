import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class Retry {
  private constructor(
    readonly max: number,
    readonly firstMs: number,
    readonly longestMs: number,
  ) {}

  static never(): Retry {
    return new Retry(1, 0, 0);
  }

  static backoff(input: {
    max: number;
    firstMs: number;
    longestMs: number;
  }): Retry {
    if (!Number.isInteger(input.max) || input.max < 2) {
      throw new InconsistentStateError(
        'retry',
        `must allow at least one more attempt, not ${input.max} in all`,
      );
    }

    if (input.firstMs < 0 || input.longestMs < input.firstMs) {
      throw new InconsistentStateError(
        'retry',
        `cannot wait from ${input.firstMs}ms up to ${input.longestMs}ms`,
      );
    }

    return new Retry(input.max, input.firstMs, input.longestMs);
  }

  get retries(): boolean {
    return this.max > 1;
  }

  exhaustedAfter(failures: number): boolean {
    return failures >= this.max;
  }

  after(failures: number, now: Date): Date | null {
    if (this.exhaustedAfter(failures)) {
      return null;
    }

    const wait = Math.min(
      this.firstMs * 2 ** (Math.max(failures, 1) - 1),
      this.longestMs,
    );

    return new Date(now.getTime() + wait);
  }

  equals(other: Retry): boolean {
    return (
      this.max === other.max &&
      this.firstMs === other.firstMs &&
      this.longestMs === other.longestMs
    );
  }
}
