import { InvalidRunnerPoolError } from '@domain/exceptions/invalid-runner-pool.error';

const MAX_LENGTH = 60;

/**
 * Which queue a runner may take work from. A runner in no pool matches nothing
 * the queue holds, so it would answer forever and never be given work.
 */
export class RunnerPool {
  private constructor(readonly value: string) {}

  static of(raw: string): RunnerPool {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidRunnerPoolError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidRunnerPoolError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new RunnerPool(trimmed);
  }

  equals(other: RunnerPool): boolean {
    return this.value === other.value;
  }
}
