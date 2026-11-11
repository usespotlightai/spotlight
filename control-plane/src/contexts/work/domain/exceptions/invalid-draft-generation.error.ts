import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidDraftGenerationError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(value: number) {
    super(`Draft generation ${value} is not a whole number from zero.`);
    this.name = 'InvalidDraftGenerationError';
  }
}
