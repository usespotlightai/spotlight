import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidEgressError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`Egress ${field} ${because}.`);
    this.name = 'InvalidEgressError';
  }
}
