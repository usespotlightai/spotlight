import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NoRepositoryError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason = 'Line has no repository to open.') {
    super(reason);
    this.name = 'NoRepositoryError';
  }
}
