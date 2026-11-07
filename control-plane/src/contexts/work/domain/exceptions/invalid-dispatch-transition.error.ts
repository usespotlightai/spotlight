import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidDispatchTransitionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidDispatchTransitionError';
  }
}
