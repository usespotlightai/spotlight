import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ClaimNotInDisputeError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(disagreementId: string, claim: number) {
    super(
      `Claim ${claim + 1} is not in dispute in judge disagreement ${disagreementId}. Answer only a claim the judge and people read differently.`,
    );
    this.name = 'ClaimNotInDisputeError';
  }
}
