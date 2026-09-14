import { InvalidRunnerNameError } from '@domain/exceptions/invalid-runner-name.error';

const MAX_LENGTH = 60;

export class RunnerName {
  private readonly kind = 'runner-name' as const;

  private constructor(readonly value: string) {}

  static of(raw: string): RunnerName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidRunnerNameError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidRunnerNameError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new RunnerName(trimmed);
  }

  equals(other: RunnerName): boolean {
    return this.value === other.value && this.kind === other.kind;
  }
}
