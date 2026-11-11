import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRubricScaleError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Rubric scale ${reason}.`);
    this.name = 'InvalidRubricScaleError';
  }
}
