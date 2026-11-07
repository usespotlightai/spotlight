import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownNetworkCallError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(id: string) {
    super(`Network call ${id} not found.`);
    this.name = 'UnknownNetworkCallError';
  }
}
