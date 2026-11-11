import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RefreshClaimedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(integration: string) {
    super(
      `The ${integration} connection is already being refreshed. Please try again later.`,
    );
    this.name = 'RefreshClaimedError';
  }
}
