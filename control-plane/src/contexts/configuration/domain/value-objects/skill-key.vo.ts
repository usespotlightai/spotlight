import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class SkillKey {
  private constructor(readonly value: string) {}

  static of(raw: string): SkillKey {
    const trimmed = raw.trim();

    if (!isSlug(trimmed)) {
      throw new InvalidIdentifierError(
        'skill',
        `must be lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in spotlight-handover`,
      );
    }

    return new SkillKey(trimmed);
  }

  get isSpotlights(): boolean {
    return this.value.startsWith('spotlight-');
  }

  equals(other: SkillKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
