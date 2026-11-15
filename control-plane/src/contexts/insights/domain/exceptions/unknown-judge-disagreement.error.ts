import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownJudgeDisagreementError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(disagreementId: string) {
    super(`Judge disagreement ${disagreementId} not found.`);
    this.name = 'UnknownJudgeDisagreementError';
  }
}
