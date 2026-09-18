import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class SkillKey {
  private constructor(readonly value: string) {}

  static of(raw: string): SkillKey {
    const trimmed = raw.trim();

    if (!areWords(trimmed)) {
      throw new InvalidIdentifierError(
        'skill',
        `is lower case words joined by dashes, at most ${LONGEST_WORDS} characters, as in spotlight-handover`,
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
