import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class OidcTrustVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(trustId: string) {
    super(
      `OIDC trust ${trustId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'OidcTrustVersionConflictError';
  }
}
