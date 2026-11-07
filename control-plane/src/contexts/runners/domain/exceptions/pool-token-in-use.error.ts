import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class PoolTokenInUseError extends DomainError {
  readonly kind = 'invalid' as const;

  readonly field = 'token';

  readonly because =
    'is in use by another pool. Please use a different token for each pool';

  constructor() {
    super(
      'Pool token is in use by another pool. Please use a different token for each pool.',
    );
    this.name = 'PoolTokenInUseError';
  }
}
