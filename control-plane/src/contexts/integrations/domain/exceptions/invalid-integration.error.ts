import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidIntegrationError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    integration: string,
    readonly because: string,
  ) {
    super(`Integration ${integration} ${because}.`);
    this.name = 'InvalidIntegrationError';
  }
}
