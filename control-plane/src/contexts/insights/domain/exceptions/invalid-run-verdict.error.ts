import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunVerdictError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A verdict on a run ${reason}.`);
    this.name = 'InvalidRunVerdictError';
  }
}
