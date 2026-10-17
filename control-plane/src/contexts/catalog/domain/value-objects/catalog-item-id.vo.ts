import { InvalidCatalogEntryError } from '@catalog/domain/exceptions/invalid-catalog-entry.error';
import { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import { CatalogVersion } from '@catalog/domain/value-objects/catalog-version.vo';
import {
  CATALOG_INTEGRATION,
  catalogReferenceParts,
  isCatalogReference,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class CatalogItemId {
  private constructor(
    readonly name: CatalogName,
    readonly version: CatalogVersion,
  ) {}

  static of(name: CatalogName, version: CatalogVersion): CatalogItemId {
    return new CatalogItemId(name, version);
  }

  static parse(raw: string): CatalogItemId {
    const trimmed = raw.trim();

    if (!isCatalogReference(trimmed)) {
      throw new InvalidCatalogEntryError(
        'name',
        `Catalog name "${trimmed}" must be a catalog id, such as ${CATALOG_INTEGRATION}.web-search@1.4.0.`,
      );
    }

    const { name, version } = catalogReferenceParts(trimmed);

    return new CatalogItemId(CatalogName.of(name), CatalogVersion.of(version));
  }

  get value(): string {
    return `${CATALOG_INTEGRATION}.${this.name.value}@${this.version.value}`;
  }

  equals(other: CatalogItemId): boolean {
    return this.name.equals(other.name) && this.version.equals(other.version);
  }

  toString(): string {
    return this.value;
  }
}
