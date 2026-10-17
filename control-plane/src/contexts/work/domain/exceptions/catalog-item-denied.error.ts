import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';

export class CatalogItemDeniedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(denied: DeniedCatalogItem) {
    super(denied.saying);
    this.name = 'CatalogItemDeniedError';
  }
}
