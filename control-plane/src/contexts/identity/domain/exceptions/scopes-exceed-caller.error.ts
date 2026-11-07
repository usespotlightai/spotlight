import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ScopesExceedCallerError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(key: string) {
    super(`OIDC trust ${key} grants scopes your token does not have.`);
    this.name = 'ScopesExceedCallerError';
  }
}
