import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidSearchIterationError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(iteration: unknown) {
    super(
      `Search iteration must be a whole number from 1. Value: ${String(iteration)}`,
    );
    this.name = 'InvalidSearchIterationError';
  }
}
