import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class IntegrationAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(`Integration ${integration} already exists in this team.`);
    this.name = 'IntegrationAlreadyExistsError';
  }
}
