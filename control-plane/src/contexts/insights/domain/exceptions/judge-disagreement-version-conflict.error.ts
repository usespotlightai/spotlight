import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class JudgeDisagreementVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(disagreementId: string) {
    super(
      `Judge disagreement ${disagreementId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'JudgeDisagreementVersionConflictError';
  }
}
