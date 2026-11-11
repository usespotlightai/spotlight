import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';

export class RunAttempt {
  private constructor(readonly value: number) {}

  static of(raw: number): RunAttempt {
    if (!Number.isInteger(raw) || raw < 1) {
      throw new InvalidWorkspaceTokenError(
        'attempt',
        'must be a run attempt, counted from 1',
      );
    }

    return new RunAttempt(raw);
  }

  equals(other: RunAttempt): boolean {
    return this.value === other.value;
  }
}
