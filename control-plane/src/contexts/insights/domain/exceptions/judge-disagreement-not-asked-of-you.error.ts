import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class JudgeDisagreementNotAskedOfYouError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(disagreementId: string) {
    super(
      `Judge disagreement ${disagreementId} asks another person. Only that person can answer it.`,
    );
    this.name = 'JudgeDisagreementNotAskedOfYouError';
  }
}
