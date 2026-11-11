import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidCatalogEntryError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: 'name' | 'version',
    readonly because: string,
  ) {
    super(because);
    this.name = 'InvalidCatalogEntryError';
  }
}
