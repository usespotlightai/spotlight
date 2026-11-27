import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class ProfileKey {
  private constructor(readonly value: string) {}

  static of(raw: string): ProfileKey {
    const trimmed = raw.trim();

    if (!isSlug(trimmed)) {
      throw InvalidIdentifierError.notSlug('harness profile', 'careful');
    }

    return new ProfileKey(trimmed);
  }

  equals(other: ProfileKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
