import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidJudgingFailureError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(code: string) {
    super(`Judging failed with unknown code ${code}.`);
    this.name = 'InvalidJudgingFailureError';
  }
}
