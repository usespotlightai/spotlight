import { InvalidHarnessIdError } from '@domain/exceptions/invalid-harness-id.error';

const MAX_LENGTH = 60;

export class HarnessId {
  private constructor(readonly value: string) {}

  static of(raw: string): HarnessId {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidHarnessIdError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidHarnessIdError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new HarnessId(trimmed);
  }

  equals(other: HarnessId): boolean {
    return this.value === other.value;
  }
}
