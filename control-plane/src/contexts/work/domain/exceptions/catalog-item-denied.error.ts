import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';

export class CatalogItemDeniedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(denied: DeniedCatalogItem) {
    super(denied.description);
    this.name = 'CatalogItemDeniedError';
  }
}
