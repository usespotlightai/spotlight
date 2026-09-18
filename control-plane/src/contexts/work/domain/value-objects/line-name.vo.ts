import { InvalidLineNameError } from '@work/domain/exceptions/invalid-line-name.error';

const MAX_LENGTH = 100;

export class LineName {
  private readonly kind = 'line-name' as const;

  private constructor(readonly value: string) {}

  static of(raw: string): LineName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidLineNameError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidLineNameError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new LineName(trimmed);
  }

  equals(other: LineName): boolean {
    return this.value === other.value && this.kind === other.kind;
  }
}
