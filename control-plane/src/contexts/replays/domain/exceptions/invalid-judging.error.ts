import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidJudgingError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Judging ${reason}.`);
    this.name = 'InvalidJudgingError';
  }
}
