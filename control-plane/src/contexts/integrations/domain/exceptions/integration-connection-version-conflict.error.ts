import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class IntegrationConnectionVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(
      `Connection ${integration} changed while it was being refreshed. Please try again.`,
    );
    this.name = 'IntegrationConnectionVersionConflictError';
  }
}
