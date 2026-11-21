import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidPlanError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(raw: string, valid: readonly string[]) {
    super(`Plan ${raw} does not exist. Valid plans: ${valid.join(', ')}.`);
    this.name = 'InvalidPlanError';
  }
}
