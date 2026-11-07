import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidToolInputError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(tool: string, because: string) {
    super(`${tool} ${because}`);
    this.name = 'InvalidToolInputError';
  }
}
