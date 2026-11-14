import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class IntegrationNotFoundError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(integration: string) {
    super(`Integration ${integration} not found.`);
    this.name = 'IntegrationNotFoundError';
  }
}
