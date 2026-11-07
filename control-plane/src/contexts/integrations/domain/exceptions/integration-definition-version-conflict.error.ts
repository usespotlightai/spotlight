import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class IntegrationDefinitionVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(`Integration ${integration} changed while saving. Please try again.`);
    this.name = 'IntegrationDefinitionVersionConflictError';
  }
}
