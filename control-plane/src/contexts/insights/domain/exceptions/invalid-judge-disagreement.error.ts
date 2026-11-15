import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidJudgeDisagreementError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A judge disagreement ${reason}.`);
    this.name = 'InvalidJudgeDisagreementError';
  }
}
