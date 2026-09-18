import { InvalidHarnessNameError } from '@work/domain/exceptions/invalid-harness-name.error';

const MAX_LENGTH = 100;

export class HarnessName {
  private readonly kind = 'harness-name' as const;

  private constructor(readonly value: string) {}

  static of(raw: string): HarnessName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidHarnessNameError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidHarnessNameError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new HarnessName(trimmed);
  }

  equals(other: HarnessName): boolean {
    return this.value === other.value && this.kind === other.kind;
  }
}
