import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SearchProposalsExhaustedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly max: number) {
    super(
      `This search iteration has proposed its ${max} candidates, or tried to too often; end the run`,
    );
    this.name = 'SearchProposalsExhaustedError';
  }
}
