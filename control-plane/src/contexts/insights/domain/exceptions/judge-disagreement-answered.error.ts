import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class JudgeDisagreementAnsweredError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(disagreementId: string) {
    super(`Judge disagreement ${disagreementId} already has an answer.`);
    this.name = 'JudgeDisagreementAnsweredError';
  }
}
