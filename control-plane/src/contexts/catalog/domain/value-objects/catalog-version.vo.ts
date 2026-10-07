import { InvalidCatalogEntryError } from '@catalog/domain/exceptions/invalid-catalog-entry.error';
import { CATALOG_VERSION } from '@shared-kernel/domain/value-objects/identifier-shapes';

const EXACTLY_VERSION = new RegExp(`^${CATALOG_VERSION}$`);

export class CatalogVersion {
  private constructor(
    readonly major: number,
    readonly minor: number,
    readonly patch: number,
  ) {}

  static of(raw: string): CatalogVersion {
    const trimmed = raw.trim();

    if (!EXACTLY_VERSION.test(trimmed)) {
      throw new InvalidCatalogEntryError(
        'version',
        'must be three whole numbers joined by dots, such as 1.4.0',
      );
    }

    const [major, minor, patch] = trimmed.split('.').map(Number);

    return new CatalogVersion(major, minor, patch);
  }

  static at(major: number, minor = 0, patch = 0): CatalogVersion {
    return new CatalogVersion(major, minor, patch);
  }

  compare(other: CatalogVersion): number {
    return (
      this.major - other.major ||
      this.minor - other.minor ||
      this.patch - other.patch
    );
  }

  equals(other: CatalogVersion): boolean {
    return this.compare(other) === 0;
  }

  get value(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }

  toString(): string {
    return this.value;
  }
}
