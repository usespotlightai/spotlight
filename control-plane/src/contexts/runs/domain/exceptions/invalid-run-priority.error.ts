import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunPriorityError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run priority ${reason}.`);
    this.name = 'InvalidRunPriorityError';
  }
}
