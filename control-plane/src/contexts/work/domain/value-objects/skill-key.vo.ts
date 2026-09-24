import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  areWords,
  CATALOG,
  isCatalogReference,
  LONGEST_WORDS,
  unversioned,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class SkillKey {
  private constructor(readonly value: string) {}

  static of(raw: string): SkillKey {
    const trimmed = raw.trim();

    if (!areWords(trimmed) && !isCatalogReference(trimmed)) {
      throw new InvalidIdentifierError(
        'skill',
        `is lower case words joined by dashes, at most ${LONGEST_WORDS} characters, as in spotlight-handover, or a catalog skill’s id, as in catalog.research@1.0.0`,
      );
    }

    return new SkillKey(trimmed);
  }

  get isSpotlights(): boolean {
    return this.value.startsWith('spotlight-');
  }

  get catalogued(): boolean {
    return isCatalogReference(this.value);
  }

  get unversioned(): string {
    return unversioned(this.value);
  }

  get folder(): string {
    return this.catalogued
      ? `spotlight-${CATALOG}-${this.unversioned.slice(CATALOG.length + 1)}`
      : this.value;
  }

  equals(other: SkillKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
