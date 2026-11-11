import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidOidcTrustError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`OIDC trust ${field} ${because}.`);
    this.name = 'InvalidOidcTrustError';
  }
}
