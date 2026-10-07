import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';

const MOST = 10_000;

export class MaxRuns {
  private readonly kind = 'max-runs';

  private constructor(readonly value: number) {}

  static of(raw: number): MaxRuns {
    if (!Number.isInteger(raw) || raw < 1 || raw > MOST) {
      throw new InvalidRunnerPoolError(
        'maxRuns',
        `must be a whole number from 1 to ${MOST}`,
      );
    }

    return new MaxRuns(raw);
  }

  allows(running: number): boolean {
    return running < this.value;
  }

  roomAfter(running: number): number {
    return Math.max(0, this.value - running);
  }

  equals(other: MaxRuns): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
