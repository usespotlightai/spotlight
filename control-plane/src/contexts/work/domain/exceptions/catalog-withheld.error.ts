import type { CatalogWithheld } from '@work/domain/value-objects/catalog-withheld.vo';

export class CatalogWithheldError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(withheld: CatalogWithheld) {
    super(withheld.saying);
    this.name = 'CatalogWithheldError';
  }
}
