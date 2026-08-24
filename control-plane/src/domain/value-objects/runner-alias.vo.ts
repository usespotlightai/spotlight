import { InvalidRunnerAliasError } from '@domain/exceptions/invalid-runner-alias.error';

const MAX_LENGTH = 60;

/**
 * What a person calls a runner. Distinct from RunnerId, which is the identity
 * the control plane assigns and nobody types.
 */
export class RunnerAlias {
  private constructor(readonly value: string) {}

  static of(raw: string): RunnerAlias {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidRunnerAliasError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidRunnerAliasError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new RunnerAlias(trimmed);
  }

  equals(other: RunnerAlias): boolean {
    return this.value === other.value;
  }
}
