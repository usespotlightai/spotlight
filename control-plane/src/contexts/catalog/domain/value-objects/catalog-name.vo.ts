import { InvalidCatalogEntryError } from '@catalog/domain/exceptions/invalid-catalog-entry.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class CatalogName {
  private constructor(readonly value: string) {}

  static of(raw: string): CatalogName {
    const trimmed = raw.trim();

    if (!areWords(trimmed)) {
      throw new InvalidCatalogEntryError(
        'name',
        `is lower case words joined by dashes, at most ${LONGEST_WORDS} characters, as in web-search`,
      );
    }

    return new CatalogName(trimmed);
  }

  equals(other: CatalogName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
