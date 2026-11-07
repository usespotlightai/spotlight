import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRubricError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Rubric ${reason}.`);
    this.name = 'InvalidRubricError';
  }
}
