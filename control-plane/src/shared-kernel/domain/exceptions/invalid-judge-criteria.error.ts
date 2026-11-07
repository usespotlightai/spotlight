import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidJudgeCriteriaError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Judge ${reason}.`);
    this.name = 'InvalidJudgeCriteriaError';
  }
}
