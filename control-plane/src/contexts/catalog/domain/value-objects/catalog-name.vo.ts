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
        `Catalog name "${trimmed}" must be lowercase words joined by dashes, such as web-search. Maximum length: ${LONGEST_WORDS} characters`,
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
