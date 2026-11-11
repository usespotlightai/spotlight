import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidToolInputsError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(because);
    this.name = 'InvalidToolInputsError';
  }
}
