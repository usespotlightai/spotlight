import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidIntegrationPartError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    part: string,
    readonly because: string,
  ) {
    super(`Integration ${part} ${because}.`);
    this.name = 'InvalidIntegrationPartError';
  }
}
