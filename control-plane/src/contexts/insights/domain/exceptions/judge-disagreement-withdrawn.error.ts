import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class JudgeDisagreementWithdrawnError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(disagreementId: string) {
    super(
      `Judge disagreement ${disagreementId} is withdrawn. The judge and people agree now, the claims changed, or the outcome a person gave is gone.`,
    );
    this.name = 'JudgeDisagreementWithdrawnError';
  }
}
