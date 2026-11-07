import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownHostError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(hostId: string) {
    super(`Host ${hostId} not found.`);
    this.name = 'UnknownHostError';
  }
}
