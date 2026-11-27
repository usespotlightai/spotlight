import { InvalidCatalogEntryError } from '@catalog/domain/exceptions/invalid-catalog-entry.error';
import {
  isSlug,
  slugAdvice,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class CatalogName {
  private constructor(readonly value: string) {}

  static of(raw: string): CatalogName {
    const trimmed = raw.trim();

    if (!isSlug(trimmed)) {
      throw new InvalidCatalogEntryError(
        'name',
        `Catalog name "${trimmed}" is not valid. ${slugAdvice('web-search')}`,
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
