import { InvalidHarnessSessionError } from '@work/domain/exceptions/invalid-harness-session.error';

const MAX_LENGTH = 200;

export class HarnessSession {
  private constructor(readonly value: string) {}

  static of(raw: string): HarnessSession {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidHarnessSessionError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidHarnessSessionError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new HarnessSession(trimmed);
  }

  equals(other: HarnessSession): boolean {
    return this.value === other.value;
  }
}
