import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class OidcTrustAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly key: string) {
    super(
      `An OIDC trust with key ${key} already exists. Please choose another key.`,
    );
    this.name = 'OidcTrustAlreadyExistsError';
  }
}
