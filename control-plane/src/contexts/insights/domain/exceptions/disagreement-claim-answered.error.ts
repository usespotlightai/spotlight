import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class DisagreementClaimAnsweredError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(disagreementId: string, claim: number) {
    super(
      `Claim ${claim + 1} of judge disagreement ${disagreementId} already has an answer.`,
    );
    this.name = 'DisagreementClaimAnsweredError';
  }
}
